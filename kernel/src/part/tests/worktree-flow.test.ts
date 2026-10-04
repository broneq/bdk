// One worktree part through the kernel in-process, on a real repository
// (`kernel-cli/part`, `kernel-cli/attempt`, `kernel-cli/dispatch`; T45): start,
// a conflicting merge back, the merge ticket and its package, the resolved
// merge, the clean merge back. `worktree.e2e.ts` runs the same flow through
// the built bundle, one behaviour per test.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { REPO_ROOT } from "../../../tests/support/run.ts";
import { registrations, settingsRegistry } from "../../registrations.ts";
import { systemClock } from "../../shared/clock/index.ts";
import { findWorkTree, systemGit } from "../../shared/git/index.ts";
import { createRegistry, loadIndex } from "../../shared/registry/index.ts";
import {
  fileIndex,
  fileRegistry,
  fileStore,
  resolveActiveChange,
} from "../../shared/store/index.ts";

let root: string;
let home: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-worktree-flow-")));
  home = join(root, "user");
  mkdirSync(home);
  root = join(root, "repo");
  mkdirSync(root);
  sh(root, "init", "--quiet", "-b", "main");
  sh(root, "config", "user.name", "BDK Test");
  sh(root, "config", "user.email", "test@example.com");
  write(root, { "src/keep.ts": "keep\n" });
  sh(root, "add", "-A");
  sh(root, "commit", "--quiet", "-m", "initial");
});
afterEach(() => {
  rmSync(join(root, ".."), { recursive: true, force: true });
});

function sh(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function write(dir: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

interface Ran {
  readonly code: number;
  readonly json: Record<string, unknown>;
}

async function bdk(argv: readonly string[], cwd = root): Promise<Ran> {
  const index = loadIndex(commands);
  const store = fileStore();
  const registry = createRegistry(
    index,
    registrations({
      store,
      pluginRoot: REPO_ROOT,
      contract: index.contract,
      commands: index,
      settings: settingsRegistry(),
      git: systemGit,
      openIndex: fileIndex,
      openRegistry: fileRegistry,
      clock: systemClock,
    }),
    { activeChange: (where) => resolveActiveChange(store, systemGit, where) },
  );
  let stdout = "";
  const code = await registry.run({
    argv: [...argv, "--json"],
    cwd,
    runtime: {
      nodeVersion: process.versions.node,
      env: { HOME: home, PATH: process.env.PATH ?? "" },
      platform: process.platform,
      home,
      workTree: findWorkTree,
      which: () => undefined,
      readStdin: () => "",
    },
    streams: { stdout: (text) => (stdout += text), stderr: () => undefined },
  });
  return { code, json: JSON.parse(stdout) as Record<string, unknown> };
}

async function ok(argv: readonly string[], cwd = root): Promise<Record<string, unknown>> {
  const ran = await bdk(argv, cwd);
  expect(ran.code, JSON.stringify(ran.json)).toBe(0);
  return ran.json;
}

async function refusedWith(
  argv: readonly string[],
  rule: string,
): Promise<Record<string, unknown>> {
  const ran = await bdk(argv);
  expect(ran.json).toMatchObject({ rule });
  return ran.json;
}

function commitTask(cwd: string, id: string, task: string, files: Record<string, string>): void {
  write(cwd, files);
  sh(cwd, "add", "-A");
  sh(
    cwd,
    "commit",
    "--quiet",
    "-m",
    `Task ${task}\n\nBDK-Change: ${id}\nBDK-Part: 01\nBDK-Task: ${task}`,
  );
}

async function planned(isolation: string): Promise<{ id: string; dir: string }> {
  const created = await ok(["change", "new", "Flow", "--profile", "tiny", "--reason", "a test"]);
  const id = created.change as string;
  const dir = join(root, ".bdk/changes", id);
  write(dir, {
    "plan/parts/01-part.md":
      `---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\n` +
      `depends-on: []\nspec-impact: none\nisolation: ${isolation}\nisolation-reason: both regenerate the lockfile\n---\n` +
      "## 01-1 Task 1\n\n**Files:**\n\n- `src/a.ts`\n\n**Test cases:**\n\n- works\n",
  });
  await ok(["done", "plan"]);
  sh(root, "add", "-A");
  sh(root, "commit", "--quiet", "-m", "plan");
  return { id, dir };
}

describe("a worktree part in-process", () => {
  it("starts, conflicts, resolves through the merge ticket and merges back", async () => {
    const { id } = await planned("worktree");
    const started = await ok(["part", "start", "01"]);
    expect(started).toMatchObject({ isolation: "worktree" });
    const workdir = started.workdir as string;
    commitTask(workdir, id, "01-1", { "src/a.ts": "a\n", "lock.txt": "part\n" });
    write(workdir, { "src/gen.ts": "generated\n" });

    write(root, { "lock.txt": "dirty\n" });
    await refusedWith(["part", "done", "01"], "policy/merge-blocked");
    sh(root, "add", "lock.txt");
    sh(root, "commit", "--quiet", "-m", "home lock");
    await refusedWith(["part", "done", "01"], "policy/merge-conflict");

    const opened = await ok(["attempt", "open", "verify-fix", "01"]);
    expect(opened).toMatchObject({ merge: true, conflicts: ["lock.txt"] });
    const ticket = opened.ticket as string;
    const built = await ok(["dispatch", "build", "01", "verifier", ticket]);
    const text = readFileSync(join(root, built.path as string), "utf8");
    expect(text).toContain(`workdir: ${workdir}`);
    expect(text).toContain("## Conflict");

    await refusedWith(["attempt", "close", ticket, "ok"], "policy/merge-unresolved");
    write(workdir, { "lock.txt": "merged\n" });
    const closed = await ok(["attempt", "close", ticket, "ok"]);
    expect(closed.next).toMatchObject({ action: "part-done" });

    const done = await ok(["part", "done", "01"], workdir);
    expect(done).toMatchObject({ discarded: ["src/gen.ts"] });
    expect(existsSync(workdir)).toBe(false);
    expect(readFileSync(join(root, "lock.txt"), "utf8")).toBe("merged\n");
  });

  it("refuses worktree-dirty, then parks an exhausted merge round", async () => {
    write(root, {
      ".bdk/settings.yaml":
        "policy:\n  budgets:\n    verify-fix: 1\n  escalation:\n    enabled: false\n",
    });
    const { id } = await planned("worktree");
    const workdir = (await ok(["part", "start", "01"])).workdir as string;
    commitTask(workdir, id, "01-1", { "src/a.ts": "a\n", "lock.txt": "part\n" });
    write(workdir, { "src/a.ts": "again\n" });
    await refusedWith(["part", "done", "01"], "policy/worktree-dirty");
    sh(workdir, "checkout", "--", "src/a.ts");
    write(root, { "lock.txt": "home\n" });
    sh(root, "add", "lock.txt");
    sh(root, "commit", "--quiet", "-m", "home lock");
    await refusedWith(["part", "done", "01"], "policy/merge-conflict");
    const ticket = (await ok(["attempt", "open", "verify-fix", "01"])).ticket as string;
    const closed = await ok(["attempt", "close", ticket, "fail"]);
    expect(closed.next).toMatchObject({ action: "parked" });
  });

  it("runs a shared part in the home checkout", async () => {
    const { id } = await planned("shared");
    expect(await ok(["part", "start", "01"])).toMatchObject({ isolation: "shared" });
    commitTask(root, id, "01-1", { "src/a.ts": "a\n" });
    const done = await ok(["part", "done", "01"]);
    expect(done).not.toHaveProperty("merge");
  });
});

describe("bdk rebuild in-process", () => {
  async function started(): Promise<{ id: string; workdir: string; branch: string }> {
    const { id } = await planned("worktree");
    const workdir = (await ok(["part", "start", "01"])).workdir as string;
    commitTask(workdir, id, "01-1", { "src/a.ts": "a\n" });
    return { id, workdir, branch: `bdk-part/${id}/01` };
  }

  it("keeps a live worktree and recreates a deleted one from its branch", async () => {
    const { workdir } = await started();
    expect(await ok(["rebuild"])).toMatchObject({
      worktrees: [{ part: "01", path: workdir, action: "kept" }],
      warnings: [],
    });
    rmSync(workdir, { recursive: true, force: true });
    const rebuilt = await ok(["rebuild"]);
    expect(rebuilt).toMatchObject({
      worktrees: [{ part: "01", path: workdir, action: "recreated" }],
    });
    expect(readFileSync(join(workdir, "src/a.ts"), "utf8")).toBe("a\n");
  });

  it("warns a started part whose worktree and branch are both gone", async () => {
    const { workdir, branch } = await started();
    sh(root, "worktree", "remove", "--force", workdir);
    sh(root, "branch", "-D", branch);
    const rebuilt = await ok(["rebuild"]);
    expect(rebuilt.worktrees).toStrictEqual([]);
    expect(rebuilt.warnings).toStrictEqual([
      `part 01 was started in a worktree, but neither the worktree nor the branch ${branch} exists; close its start marker, then run bdk part start 01`,
    ]);
  });

  it("settles the leftovers of a done part by whether the home checkout holds them", async () => {
    const { id, workdir, branch } = await started();
    await ok(["part", "done", "01"]);
    const mark = () => {
      const gitDir = sh(workdir, "rev-parse", "--absolute-git-dir").trim();
      writeFileSync(join(gitDir, "bdk-home"), `${root}\n${id}\n`);
    };

    sh(root, "branch", branch, "HEAD");
    expect(await ok(["rebuild"])).toMatchObject({ worktrees: [], warnings: [] });
    expect(sh(root, "branch", "--list", branch).trim()).toBe("");

    sh(root, "worktree", "add", "--quiet", "-b", branch, workdir, "HEAD");
    mark();
    expect((await ok(["rebuild"])).worktrees).toStrictEqual([
      { part: "01", path: workdir, action: "removed" },
    ]);

    sh(root, "worktree", "add", "--quiet", "-b", branch, workdir, "HEAD");
    mark();
    write(workdir, { "src/late.ts": "late\n" });
    sh(workdir, "add", "-A");
    sh(workdir, "commit", "--quiet", "-m", "late work");
    const kept = await ok(["rebuild"]);
    expect(kept.worktrees).toStrictEqual([{ part: "01", path: workdir, action: "kept" }]);
    expect(kept.warnings).toStrictEqual([
      `branch ${branch} of part 01, which is not live, holds commits the home checkout lacks; kept with its worktree ${workdir}`,
    ]);

    sh(root, "worktree", "remove", "--force", workdir);
    expect((await ok(["rebuild"])).warnings).toStrictEqual([
      `branch ${branch} of part 01, which is not live, holds commits the home checkout lacks; kept`,
    ]);
    expect(sh(root, "branch", "--list", branch).trim()).not.toBe("");
  });
});
