// `kernel-state`, Two-branch merge (design D-11 of v3-t14-state-schema): two
// branches of one Change write through `writeDocument` in a real repository
// and merge with `git merge --no-ff`. T20 reruns the scenario on the output of
// the real commands.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { newId } from "../../src/shared/ids/index.ts";
import {
  fileStore,
  learningFingerprint,
  readDocument,
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

/** Reads every state file of the work tree through the store; the entry, evidence and ticket ids. */
function validateTree(root: string): string[] {
  const store = fileStore();
  const ids: string[] = [];
  const bdk = join(root, ".bdk");
  for (const entry of readdirSync(bdk, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const document = readDocument(store, join(entry.parentPath, entry.name));
    if (document === undefined || !("data" in document)) continue;
    if (document.kind === "attempt") ids.push(String(document.data.ticket));
    if (document.kind === "entry" || document.kind === "evidence") {
      ids.push(String(document.data.id));
    }
  }
  return ids;
}

describe("two-branch merge", () => {
  it("merges parallel work on one Change without conflict", () => {
    const root = forked();
    on(root, "a", () => {
      work(root, "a", "2026-09-26T08:00:00Z", "TQ-8", "auth-session");
    });
    on(root, "b", () => {
      work(root, "b", "2026-09-26T08:00:00Z", "TQ-9", "auth-mail");
    });
    expect(merge(root)).toStrictEqual([]);
    const ids = validateTree(root);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
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
