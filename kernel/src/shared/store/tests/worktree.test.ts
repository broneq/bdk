// The home of a part worktree and the work root of a target (`kernel-state`,
// Part worktree; `kernel-cli`, Invocation; T45 design D3, D4).
import { describe, expect, it } from "vitest";

import type { Git } from "../../git/index.ts";
import { KernelRefusal } from "../../refusal/index.ts";
import { resolveActiveChange } from "../changes.ts";
import { findProjectRoot, memoryStore } from "../store.ts";
import {
  homeMarkerPath,
  partBranch,
  partWorktree,
  readHomeMarker,
  workRootOf,
  writeHomeMarker,
} from "../worktree.ts";

const HOME = "/repo";
const ID = "2026-10-04-lockfile";
const WT = `${HOME}/.bdk/.machine/worktrees/${ID}/02`;
const GIT_DIR = `${HOME}/.git/worktrees/02`;

function world(listed: readonly { path: string; branch?: string }[] = []) {
  const store = memoryStore({
    [`${HOME}/.git/HEAD`]: "ref: refs/heads/feat/lockfile\n",
    [`${HOME}/.bdk/changes/${ID}/change.md`]: "x",
    [`${HOME}/.bdk/.machine/branches/feat%2Flockfile`]: `${ID}\n`,
    [`${WT}/.git`]: `gitdir: ${GIT_DIR}\n`,
    [`${WT}/src/a.ts`]: "a\n",
    [`${GIT_DIR}/HEAD`]: `ref: refs/heads/${partBranch(ID, "02")}\n`,
  });
  const porcelain = listed
    .map(
      (found) =>
        `worktree ${found.path}\0HEAD ${"1".repeat(40)}\0${found.branch === undefined ? "detached" : `branch refs/heads/${found.branch}`}\0\0`,
    )
    .join("");
  const git: Git = {
    run: (args) =>
      Promise.resolve(
        args[0] === "worktree" && args[1] === "list"
          ? { code: 0, stdout: porcelain, stderr: "" }
          : { code: 1, stdout: "", stderr: `unexpected git ${args.join(" ")}` },
      ),
    currentBranch: (workTree) =>
      workTree === HOME ? "feat/lockfile" : workTree === WT ? partBranch(ID, "02") : undefined,
  };
  return { store, git };
}

const PARTS = [
  {
    id: "02",
    tasks: [{ id: "02-1" }, { id: "02-2" }],
  },
  { id: "01", tasks: [{ id: "01-1" }] },
] as const;

describe("home marker", () => {
  it("is written in the worktree's own git directory and read back", () => {
    const { store } = world();
    expect(homeMarkerPath(store, WT)).toBe(`${GIT_DIR}/bdk-home`);
    writeHomeMarker(store, WT, HOME, ID);
    expect(store.read(`${GIT_DIR}/bdk-home`)).toBe(`${HOME}\n${ID}\n`);
    expect(readHomeMarker(store, WT)).toStrictEqual({ home: HOME, change: ID });
    expect(readHomeMarker(store, HOME)).toBeUndefined();
  });
});

describe("findProjectRoot inside a worktree", () => {
  it("answers the home project root the marker names", () => {
    const { store } = world();
    writeHomeMarker(store, WT, HOME, ID);
    expect(findProjectRoot(store, `${WT}/src`, WT)).toBe(HOME);
  });

  it("refuses state/worktree-orphaned when the home is gone", () => {
    const { store } = world();
    writeHomeMarker(store, WT, "/elsewhere", ID);
    try {
      findProjectRoot(store, `${WT}/src`, WT);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(KernelRefusal);
      expect((error as KernelRefusal).refusal).toMatchObject({
        rule: "state/worktree-orphaned",
        instead: ["bdk rebuild"],
      });
      expect((error as KernelRefusal).refusal.why).toContain("/elsewhere");
    }
  });

  it("resolves the marker's Change with the home branch", () => {
    const { store, git } = world();
    writeHomeMarker(store, WT, HOME, ID);
    expect(resolveActiveChange(store, git, { cwd: `${WT}/src`, workTree: WT })).toStrictEqual({
      id: ID,
      dir: `${HOME}/.bdk/changes/${ID}`,
      projectRoot: HOME,
      branch: "feat/lockfile",
    });
  });
});

describe("work root", () => {
  const change = { id: ID, projectRoot: HOME };

  it("is the worktree for a task or the part of a live worktree part", async () => {
    const { store, git } = world([
      { path: HOME, branch: "feat/lockfile" },
      { path: WT, branch: partBranch(ID, "02") },
    ]);
    expect(await partWorktree(git, store, change, "02")).toBe(WT);
    expect(await workRootOf(git, store, change, PARTS, "02-1")).toBe(WT);
    expect(await workRootOf(git, store, change, PARTS, "02")).toBe(WT);
  });

  it("is the home checkout for a shared part, the Change and an artifact", async () => {
    const { store, git } = world([
      { path: HOME, branch: "feat/lockfile" },
      { path: WT, branch: partBranch(ID, "02") },
    ]);
    expect(await workRootOf(git, store, change, PARTS, "01-1")).toBe(HOME);
    expect(await workRootOf(git, store, change, PARTS, ID)).toBe(HOME);
    expect(await workRootOf(git, store, change, PARTS, "plan-part:02")).toBe(HOME);
  });

  it("is the home checkout for a done part and when the directory is gone", async () => {
    const done = world([{ path: HOME, branch: "feat/lockfile" }]);
    expect(await workRootOf(done.git, done.store, change, PARTS, "02-1")).toBe(HOME);
    const gone = world([
      { path: HOME, branch: "feat/lockfile" },
      { path: `${WT}-gone`, branch: partBranch(ID, "02") },
    ]);
    expect(await workRootOf(gone.git, gone.store, change, PARTS, "02-1")).toBe(HOME);
  });
});
