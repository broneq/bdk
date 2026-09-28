// `kernel-state`, Two-branch merge (design D-11 of v3-t14-state-schema): two
// branches of one Change write in a real repository and merge with
// `git merge --no-ff`. The first scenario runs the real commands (T20) in
// process against the files; the next ones write through `writeDocument` the
// documents no command writes yet (attempts, evidence, dispatch, rules).
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import commands from "../../../schema/cli/commands.json" with { type: "json" };
import { registrations, settingsRegistry } from "../../src/registrations.ts";
import { systemClock } from "../../src/shared/clock/index.ts";
import { currentBranch, findWorkTree } from "../../src/shared/git/index.ts";
import type { Git } from "../../src/shared/git/index.ts";
import { newId } from "../../src/shared/ids/index.ts";
import { createRegistry, loadIndex } from "../../src/shared/registry/index.ts";
import {
  fileIndex,
  fileStore,
  readChange,
  learningFingerprint,
  readDocument,
  resolveActiveChange,
  writeDocument,
} from "../../src/shared/store/index.ts";
import { createFixture } from "../support/fixture.ts";
import type { Fixture } from "../support/fixture.ts";
import { REPO_ROOT } from "../support/run.ts";

const FIXTURE = join(REPO_ROOT, "kernel/tests/fixtures/state");
const CHANGE_ID = "2026-09-25-passwordless-login";
const AUTHOR = "Jan Kowalski <jan@example.com>";
const HASH = `sha256:${"e".repeat(64)}`;

/** Git without the user's or the system's configuration, hooks or signing. */
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "BDK Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "BDK Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, env: GIT_ENV, encoding: "utf8" });
}

/** The kernel's git port on GIT_ENV, so the author and config come from the test. */
const testGit: Git = {
  currentBranch,
  run: (args, cwd) =>
    new Promise((done) => {
      execFile("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }, (error, stdout, stderr) => {
        const code = typeof error?.code === "number" ? error.code : error === null ? 0 : 1;
        done({ code, stdout, stderr });
      });
    }),
};

/** `bdk <argv> --json` in process, on the real files; the parsed output, or a throw on a refusal. */
async function kernel(root: string, ...argv: string[]): Promise<Record<string, unknown>> {
  const store = fileStore();
  const index = loadIndex(commands);
  const registry = createRegistry(
    index,
    registrations({
      store,
      pluginRoot: REPO_ROOT,
      contract: index.contract,
      settings: settingsRegistry(),
      git: testGit,
      openIndex: fileIndex,
      clock: systemClock,
    }),
    { activeChange: (where) => resolveActiveChange(store, testGit, where) },
  );
  let stdout = "";
  const code = await registry.run({
    argv: [...argv, "--json"],
    cwd: root,
    runtime: {
      nodeVersion: process.versions.node,
      env: { XDG_CONFIG_HOME: join(root, ".xdg") },
      platform: process.platform,
      home: root,
      workTree: findWorkTree,
      which: () => undefined,
      readStdin: () => "",
    },
    streams: { stdout: (text) => (stdout += text), stderr: () => undefined },
  });
  if (code !== 0) throw new Error(`bdk ${argv.join(" ")} exited ${String(code)}: ${stdout}`);
  return JSON.parse(stdout) as Record<string, unknown>;
}

function commit(root: string, message: string): void {
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", message);
}

function fixtureFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(join(FIXTURE, ".bdk"), {
    withFileTypes: true,
    recursive: true,
  })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[relative(FIXTURE, path)] = readFileSync(path, "utf8");
  }
  return files;
}

let repo: Fixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

/** A repository holding the fixture on `main`, with branches `a` and `b` at that commit. */
function forked(): string {
  repo = createFixture({ files: fixtureFiles() });
  const { root } = repo;
  git(root, "checkout", "--quiet", "-b", "main");
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "fixture");
  git(root, "branch", "a");
  git(root, "branch", "b");
  return root;
}

function on(root: string, branch: string, work: () => void): void {
  git(root, "checkout", "--quiet", branch);
  work();
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", `work on ${branch}`);
}

/** Merges `b` into `a`; the paths git reports as conflicted, [] on a clean merge. */
function merge(root: string): string[] {
  git(root, "checkout", "--quiet", "a");
  const result = spawnSync("git", ["merge", "--no-ff", "--no-edit", "b"], {
    cwd: root,
    env: GIT_ENV,
    encoding: "utf8",
  });
  if (result.status === 0) return [];
  return git(root, "diff", "--name-only", "--diff-filter=U").trim().split("\n").sort();
}

/** One branch's work on task 02-3 and its rule and delta, all through the store. */
function work(root: string, branch: string, at: string, rule: string, capability: string): void {
  const store = fileStore();
  const change = (path: string) => join(root, ".bdk/changes", CHANGE_ID, path);
  const stamp = at.replaceAll("-", "").replaceAll(":", "");
  const ticket = newId("A-");
  const common = { schema: 1, author: AUTHOR, at, ticket };
  const entry = (type: string, own: Record<string, unknown>) => {
    const id = newId("L-");
    const summary = `${type} from branch ${branch}`;
    writeDocument(store, change(`log/${stamp}-${type}-${id}.md`), {
      data: {
        schema: 1,
        id,
        type,
        summary,
        status: "proposed",
        source: "agent:reviewer",
        author: AUTHOR,
        at,
        ticket,
        refs: ["src/auth/magic-link.ts"],
        ...(type === "learning" ? { fingerprint: learningFingerprint(summary) } : {}),
        ...own,
      },
      body: `Written on ${branch}.\n`,
    });
  };
  entry("finding", { severity: "high" });
  entry("observation", {});
  entry("decision", {});
  entry("learning", { applies: ["**/*.ts"] });

  const attempt = change(`attempts/task-redispatch-02-3-${ticket}.md`);
  const opened = {
    schema: 1,
    ticket,
    loop: "task-redispatch",
    target: "02-3",
    attempt: 2,
    of: 3,
    scope: "high+",
    "opened-at": at,
    author: AUTHOR,
  };
  writeDocument(store, attempt, { data: opened, body: "" });
  writeDocument(store, attempt, {
    data: { ...opened, "closed-at": at, outcome: "ok" },
    body: `Closed on ${branch}.\n`,
  });

  const evidence = newId("E-");
  const capture = `.bdk/changes/${CHANGE_ID}/evidence/02-3-${evidence}.txt`;
  writeDocument(store, join(root, capture), { body: `6 passed on ${branch}\n` });
  writeDocument(store, change(`evidence/02-3-${evidence}.md`), {
    data: {
      ...common,
      id: evidence,
      kind: "tests-scoped",
      target: "02-3",
      source: "agent:implementer",
      "tree-hash": HASH,
      files: [{ path: capture, hash: HASH, stored: "committed" }],
      verdict: "pass",
    },
    body: "",
  });

  const report = `.bdk/changes/${CHANGE_ID}/reports/02-3-implementer-${ticket}.md`;
  writeDocument(store, change(`dispatch/02-3-implementer-${ticket}.md`), {
    data: {
      schema: 1,
      ticket,
      target: "02-3",
      role: "implementer",
      adapter: "worker",
      attempt: 2,
      of: 3,
      scope: "high+",
      at,
      "kernel-version": "3.0.0-dev",
      "template-hash": HASH,
      report,
    },
    body: "## Task 02-3\n",
  });
  writeDocument(store, join(root, report), {
    data: {
      schema: 1,
      ticket,
      role: "implementer",
      status: "done",
      files: ["src/auth/magic-link.ts"],
      entries: [],
      evidence: [evidence],
    },
    body: `Done on ${branch}.\n`,
  });

  writeDocument(store, join(root, `.bdk/rules/${rule}.md`), {
    data: {
      schema: 1,
      id: rule,
      kind: "house",
      severity: "low",
      origin: "import",
      since: "2026-09-27",
    },
    body: `Rule accepted on ${branch}.\n`,
  });
  writeDocument(store, change(`spec-delta/${capability}.md`), {
    body: "## ADDED Requirements\n",
  });
}

/**
 * Reads the merged Change through `readChange` (every file valid, no id used
 * twice) and every rule file; the number of Change documents.
 */
function validateTree(root: string): number {
  const store = fileStore();
  for (const name of store.list(join(root, ".bdk/rules"))) {
    readDocument(store, join(root, ".bdk/rules", name));
  }
  return readChange(store, join(root, ".bdk/changes", CHANGE_ID)).size;
}

describe("two-branch merge", () => {
  it("merges the output of the real commands on two branches without conflict", async () => {
    repo = createFixture({ files: { "README.md": "# app\n" } });
    const { root } = repo;
    git(root, "checkout", "--quiet", "-b", "main");
    const opened = await kernel(root, "change", "new", "Passwordless login");
    const id = String(opened.change);
    commit(root, "open the Change");
    git(root, "branch", "a");
    git(root, "branch", "b");
    const entryId = (result: Record<string, unknown>) => (result.entry as { id: string }).id;

    git(root, "checkout", "--quiet", "a");
    await kernel(root, "change", "resume", id);
    const finding = entryId(
      await kernel(root, "log", "add", "finding", "expired link accepted", "--ref", "src/a.ts"),
    );
    await kernel(root, "log", "add", "learning", "Check expiry on redeem", "--ref", "src/a.ts");
    await kernel(root, "log", "resolve", finding, "resolved", "--reason", "fixed on a");
    await kernel(root, "change", "park", "--option", "ship", "--option", "wait");
    await kernel(root, "change", "resume", id, "--option", "1");
    commit(root, "work on a");

    git(root, "checkout", "--quiet", "b");
    await kernel(root, "change", "resume", id);
    const assumption = (await kernel(root, "log", "list", "--type", "assumption")).items as {
      id: string;
    }[];
    await kernel(root, "log", "resolve", assumption[0]?.id ?? "", "accepted");
    await kernel(root, "log", "add", "decision", "Links expire after 15 min", "--ref", "design.md");
    await kernel(root, "log", "add", "observation", "Mail provider rate limits", "--ref", "a.ts");
    await kernel(root, "change", "resume", id, "--profile", "large");
    commit(root, "work on b");

    expect(merge(root)).toStrictEqual([]);
    const files = readChange(fileStore(), join(root, ".bdk/changes", id));
    await kernel(root, "change", "resume", id);
    const listed = (await kernel(root, "log", "list", "--all")).items as { id: string }[];
    const ids = listed.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(8);
    expect(ids).toHaveLength([...files.keys()].filter((path) => path.includes("/log/")).length);
    expect(await kernel(root, "change", "status")).toMatchObject({
      profile: "large",
      source: "user",
    });
  });

  it("merges parallel work on documents no command writes yet without conflict", () => {
    const root = forked();
    on(root, "a", () => {
      work(root, "a", "2026-09-26T08:00:00Z", "TQ-8", "auth-session");
    });
    on(root, "b", () => {
      work(root, "b", "2026-09-26T08:00:00Z", "TQ-9", "auth-mail");
    });
    expect(merge(root)).toStrictEqual([]);
    expect(validateTree(root)).toBeGreaterThan(50);
  });

  it("merges an id drawn on both branches, and reading the Change names both files", () => {
    const root = forked();
    const write = (type: string, at: string) => () => {
      const stamp = at.replaceAll("-", "").replaceAll(":", "");
      writeDocument(
        fileStore(),
        join(root, `.bdk/changes/${CHANGE_ID}/log/${stamp}-${type}-L-dup00000.md`),
        {
          data: {
            schema: 1,
            id: "L-dup00000",
            type,
            summary: `${type} with a colliding id`,
            status: "proposed",
            source: "kernel",
            author: AUTHOR,
            at,
            refs: ["design.md"],
          },
          body: "",
        },
      );
    };
    on(root, "a", write("decision", "2026-09-26T08:00:00Z"));
    on(root, "b", write("risk", "2026-09-26T08:00:01Z"));
    expect(merge(root)).toStrictEqual([]);
    expect(() => validateTree(root)).toThrow(
      /L-dup00000 is used by both .*decision-L-dup00000\.md and .*risk-L-dup00000\.md/,
    );
  });

  it("conflicts only on a rule both branches edit", () => {
    const root = forked();
    const rule = join(root, ".bdk/rules/TQ-7.md");
    const edit = (text: string) => () => {
      const store = fileStore();
      const current = readDocument(store, rule);
      if (current === undefined || !("data" in current)) throw new Error("no TQ-7");
      writeDocument(store, rule, { data: current.data, body: `${text}\n` });
    };
    on(root, "a", edit("A scoped run includes a negative case for each validation branch."));
    on(root, "b", edit("A scoped run includes one negative case per changed validator."));
    expect(merge(root)).toStrictEqual([".bdk/rules/TQ-7.md"]);
  });

  it("conflicts when the per-ticket attempt files of D-2 are given up", () => {
    const root = forked();
    const shared = join(root, `.bdk/changes/${CHANGE_ID}/attempts/task-redispatch-02-3.md`);
    const append = (branch: string) => () => {
      fileStore().write(shared, `---\nschema: 1\n---\nattempt 2 on ${branch}\n`);
    };
    on(root, "a", append("a"));
    on(root, "b", append("b"));
    expect(merge(root)).toStrictEqual([
      `.bdk/changes/${CHANGE_ID}/attempts/task-redispatch-02-3.md`,
    ]);
  });
});
