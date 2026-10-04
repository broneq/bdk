// The worktree use cases of the part slice against a real repository
// (`kernel-cli/part`, bdk part start and bdk part done; `kernel-cli/attempt`,
// the merge ticket; T45 design D2, D5, D6, D10). The bundle runs the same
// paths in `worktree.e2e.ts`.
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

import { sequentialRandom } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { systemGit } from "../../shared/git/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { fileStore, memoryIndex, partBranch, readHomeMarker } from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import type { PartDeps } from "../index.ts";
import {
  commitMergeTicket,
  createWorktree,
  mergeBack,
  openMergeTicket,
  startMarkerBody,
  unresolvedMerge,
  worktreeDir,
  worktreeSettings,
} from "../use-cases/worktree.ts";
import type { CreatedWorktree, WorktreeSettings } from "../use-cases/worktree.ts";

const ID = "2026-10-04-lockfile";

let root: string;
let change: ActiveChange;
let deps: PartDeps;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-part-worktree-")));
  sh(root, "init", "--quiet", "-b", "feat/lockfile");
  sh(root, "config", "user.name", "BDK Test");
  sh(root, "config", "user.email", "test@example.com");
  commit(root, { "a.txt": "a\n", "lock.txt": "l1\n", ".gitignore": ".bdk/.machine/\n.env\n" });
  change = {
    id: ID,
    dir: join(root, ".bdk/changes", ID),
    projectRoot: root,
    branch: "feat/lockfile",
  };
  deps = depsWith(systemGit);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function depsWith(git: Git): PartDeps {
  return {
    store: fileStore(),
    git,
    openIndex: memoryIndex,
    clock: fixedClock("2026-10-04T10:00:00.000Z"),
    random: sequentialRandom(),
    pluginRoot: "/plugins/bdk",
    settings: settingsRegistry(),
  };
}

function sh(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function commit(dir: string, files: Record<string, string>, message = "work"): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  sh(dir, "add", "-A");
  sh(dir, "commit", "--quiet", "-m", message);
}

function settings(overrides: Record<string, unknown> = {}): WorktreeSettings {
  return worktreeSettings({ execution: { worktree: overrides } });
}

function refusal(value: unknown): Refusal {
  expect(value).toHaveProperty("refused", true);
  return value as Refusal;
}

async function created(overrides: Record<string, unknown> = {}): Promise<CreatedWorktree> {
  const made = await createWorktree(deps, change, "02", settings(overrides));
  if ("refused" in made) throw new Error(made.why);
  return made;
}

const PART = {
  id: "02",
  tasks: [{ id: "02-1", files: [{ path: "src/b.ts" }] }],
} as unknown as PlanPartFile;
const INDEX = undefined as unknown as IndexDb;

describe("createWorktree", () => {
  it("creates the worktree from HEAD with its marker, include copy and setup record", async () => {
    writeFileSync(join(root, ".worktreeinclude"), ".env\n");
    writeFileSync(join(root, ".env"), "TOKEN=1\n");
    const made = await created({ setup: { command: "echo ready" } });
    expect(made.workdir).toBe(worktreeDir(settings(), change, "02"));
    expect(made.branch).toBe(partBranch(ID, "02"));
    expect(readFileSync(join(made.workdir, ".env"), "utf8")).toBe("TOKEN=1\n");
    expect(readHomeMarker(deps.store, made.workdir)).toStrictEqual({ home: root, change: ID });
    expect(made.setup).toMatchObject({ command: "echo ready", exitCode: 0, tail: ["ready"] });
    expect(startMarkerBody(made)).toMatch(
      /^workdir: .*\nsetup: echo ready\nexit-code: 0\nduration-ms: \d+\n\nready\n$/,
    );
    expect(startMarkerBody({ workdir: "/w", branch: "b" })).toBe("workdir: /w\n");
  });

  it("places an absolute dir as given and replaces a leftover worktree", async () => {
    const dir = join(root, "..", `${ID}-outside`);
    const first = await created({ dir });
    expect(first.workdir).toBe(join(dir, ID, "02"));
    writeFileSync(join(first.workdir, "stale.txt"), "stale\n");
    const again = await created({ dir });
    expect(existsSync(join(again.workdir, "stale.txt"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses runtime/git-too-old on a git before 2.38", async () => {
    const old: Git = {
      ...systemGit,
      run: (args, cwd) =>
        args[0] === "--version"
          ? Promise.resolve({ code: 0, stdout: "git version 2.37.1\n", stderr: "" })
          : systemGit.run(args, cwd),
    };
    deps = depsWith(old);
    const made = refusal(await createWorktree(deps, change, "02", settings()));
    expect(made).toMatchObject({ rule: "runtime/git-too-old" });
    expect(made.why).toContain("2.37.1");
  });

  it("refuses policy/config-invalid for a dir inside the repository that git does not ignore", async () => {
    const made = refusal(await createWorktree(deps, change, "02", settings({ dir: "worktrees" })));
    expect(made).toMatchObject({ rule: "policy/config-invalid" });
    expect(existsSync(join(root, "worktrees"))).toBe(false);
  });

  it("refuses runtime/worktree-setup-failed and removes the worktree on a failed or slow setup", async () => {
    const failed = refusal(
      await createWorktree(
        deps,
        change,
        "02",
        settings({ setup: { command: "echo broken; exit 4" } }),
      ),
    );
    expect(failed).toMatchObject({ rule: "runtime/worktree-setup-failed" });
    expect(failed.why).toContain("exited 4; output:\nbroken");
    expect(existsSync(worktreeDir(settings(), change, "02"))).toBe(false);
    expect(sh(root, "branch", "--list", partBranch(ID, "02"))).toBe("");

    const add = refusal(
      await createWorktree(
        depsWith({
          ...systemGit,
          run: (args, cwd) =>
            args[0] === "worktree" && args[1] === "add"
              ? Promise.resolve({ code: 128, stdout: "", stderr: "fatal: no space left" })
              : systemGit.run(args, cwd),
        }),
        change,
        "02",
        settings(),
      ),
    );
    expect(add.why).toContain("fatal: no space left");
  });
});

describe("mergeBack", () => {
  it("writes the merge commit, moves home and removes the worktree", async () => {
    const made = await created();
    commit(made.workdir, { "src/b.ts": "b\n" }, "Task 02-1");
    commit(root, { "c.txt": "c\n" }, "shared");
    const merged = await mergeBack(deps, change, INDEX, PART, made.workdir);
    expect(merged).toMatchObject({ discarded: [] });
    expect(sh(root, "log", "-1", "--format=%P").trim().split(" ")).toHaveLength(2);
    expect(existsSync(made.workdir)).toBe(false);
  });

  it("skips the merge when home already holds the part branch", async () => {
    const made = await created();
    commit(made.workdir, { "src/b.ts": "b\n" }, "Task 02-1");
    sh(root, "merge", "--quiet", "--no-ff", "-m", "by hand", made.branch);
    const head = sh(root, "rev-parse", "HEAD").trim();
    expect(await mergeBack(deps, change, INDEX, PART, made.workdir)).toStrictEqual({
      merge: head.slice(0, 7),
      discarded: [],
    });
  });

  it("refuses policy/worktree-dirty, policy/merge-conflict and policy/merge-blocked", async () => {
    const made = await created();
    commit(made.workdir, { "src/b.ts": "b\n", "lock.txt": "part\n" }, "Task 02-1");
    writeFileSync(join(made.workdir, "src/b.ts"), "again\n");
    expect(await mergeBack(deps, change, INDEX, PART, made.workdir)).toMatchObject({
      rule: "policy/worktree-dirty",
    });
    sh(made.workdir, "checkout", "--", "src/b.ts");

    writeFileSync(join(root, "lock.txt"), "dirty home\n");
    const blocked = refusal(await mergeBack(deps, change, INDEX, PART, made.workdir));
    expect(blocked).toMatchObject({ rule: "policy/merge-blocked" });
    expect(blocked.why).toContain("lock.txt");

    commit(root, { "lock.txt": "home\n" }, "home lock");
    const conflict = refusal(await mergeBack(deps, change, INDEX, PART, made.workdir));
    expect(conflict).toMatchObject({
      rule: "policy/merge-conflict",
      instead: ["bdk attempt open verify-fix 02"],
    });
    expect(existsSync(made.workdir)).toBe(true);
  });
});

describe("the merge ticket", () => {
  it("starts the merge once, checks the markers, then commits on the part branch", async () => {
    const made = await created();
    expect(await openMergeTicket(deps, change, "01")).toBeUndefined();
    expect(await openMergeTicket(deps, change, "02")).toBeUndefined();
    commit(made.workdir, { "lock.txt": "part\n" }, "Task 02-1");
    expect(await openMergeTicket(deps, change, "02")).toBeUndefined();
    commit(root, { "lock.txt": "home\n" }, "home lock");

    const opened = await openMergeTicket(deps, change, "02");
    expect(opened).toStrictEqual({ workdir: made.workdir, conflicts: ["lock.txt"] });
    const mergeHead = sh(made.workdir, "rev-parse", "MERGE_HEAD");
    expect(await openMergeTicket(deps, change, "02")).toStrictEqual(opened);
    expect(sh(made.workdir, "rev-parse", "MERGE_HEAD")).toBe(mergeHead);

    expect(await unresolvedMerge(deps, change, "02", ["lock.txt"])).toMatchObject({
      rule: "policy/merge-unresolved",
    });
    writeFileSync(join(made.workdir, "lock.txt"), "merged\n");
    expect(await unresolvedMerge(deps, change, "02", ["lock.txt"])).toBeUndefined();
    expect(await commitMergeTicket(deps, change, "02", ["lock.txt"])).toBeUndefined();
    expect(sh(made.workdir, "log", "-1", "--format=%s")).toBe(
      "chore(bdk): merge feat/lockfile into part 02\n",
    );
    expect(await unresolvedMerge(deps, change, "02", ["lock.txt"])).toBeUndefined();
    expect(await commitMergeTicket(deps, change, "02", ["lock.txt"])).toBeUndefined();
  });

  it("lists the merge's conflicts again once every path is staged", async () => {
    const made = await created();
    commit(made.workdir, { "lock.txt": "part\n" }, "Task 02-1");
    commit(root, { "lock.txt": "home\n" }, "home lock");
    await openMergeTicket(deps, change, "02");
    writeFileSync(join(made.workdir, "lock.txt"), "merged\n");
    sh(made.workdir, "add", "lock.txt");
    expect(await openMergeTicket(deps, change, "02")).toMatchObject({ conflicts: ["lock.txt"] });
  });

  it("refuses policy/git-hook-failed when a hook rejects the merge commit", async () => {
    const made = await created();
    commit(made.workdir, { "lock.txt": "part\n" }, "Task 02-1");
    commit(root, { "lock.txt": "home\n" }, "home lock");
    await openMergeTicket(deps, change, "02");
    writeFileSync(join(made.workdir, "lock.txt"), "merged\n");
    const hooks = join(root, "..", `${ID}-hooks`);
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, "commit-msg"), "#!/bin/sh\necho rejected >&2\nexit 1\n", {
      mode: 0o755,
    });
    sh(root, "config", "core.hooksPath", hooks);
    expect(await commitMergeTicket(deps, change, "02", ["lock.txt"])).toMatchObject({
      rule: "policy/git-hook-failed",
    });
    rmSync(hooks, { recursive: true, force: true });
  });
});
