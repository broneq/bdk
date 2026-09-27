import { describe, expect, it } from "vitest";

import type { Git } from "../../git/index.ts";
import {
  decodeBranch,
  encodeBranch,
  listChangeDirs,
  listMarkers,
  markerPath,
  readMarker,
  removeMarker,
  resolveActiveChange,
  writeMarker,
} from "../changes.ts";
import { memoryStore } from "../store.ts";

const ROOT = "/repo";
const LIVE = "2026-09-25-add-login";
const OTHER = "2026-09-26-fix-typo";
const OLD = "2026-09-20-old-work";

function world(branch: string | undefined, extra: Record<string, string> = {}) {
  const store = memoryStore({
    [`${ROOT}/.bdk/changes/${LIVE}/change.md`]: "x",
    [`${ROOT}/.bdk/changes/${OTHER}/change.md`]: "x",
    [`${ROOT}/.bdk/changes/archive/${OLD}/change.md`]: "x",
    ...extra,
  });
  const git: Git = {
    run: () => Promise.reject(new Error("no git in this test")),
    currentBranch: () => branch,
  };
  return { store, git };
}

describe("branch encoding", () => {
  it.each([
    ["main", "main"],
    ["feat/login", "feat%2Flogin"],
    ["a b%c", "a%20b%25c"],
    ["fix_1.2-x", "fix_1.2-x"],
  ])("encodes %s as %s and back", (branch, encoded) => {
    expect(encodeBranch(branch)).toBe(encoded);
    expect(decodeBranch(encoded)).toBe(branch);
    expect(markerPath(ROOT, branch)).toBe(`${ROOT}/.bdk/.machine/branches/${encoded}`);
  });
});

describe("markers", () => {
  it("writes, reads, lists and removes a marker", () => {
    const { store } = world("feat/login");
    writeMarker(store, ROOT, "feat/login", LIVE);
    writeMarker(store, ROOT, "main", OTHER);
    expect(readMarker(store, ROOT, "feat/login")).toBe(LIVE);
    expect(listMarkers(store, ROOT)).toStrictEqual([
      { branch: "feat/login", change: LIVE },
      { branch: "main", change: OTHER },
    ]);
    removeMarker(store, ROOT, "main");
    expect(readMarker(store, ROOT, "main")).toBeUndefined();
  });
});

describe("Change directories", () => {
  it("lists live and archived Changes", () => {
    const { store } = world("main");
    expect(listChangeDirs(store, ROOT)).toStrictEqual([
      { id: LIVE, dir: `${ROOT}/.bdk/changes/${LIVE}`, archived: false },
      { id: OTHER, dir: `${ROOT}/.bdk/changes/${OTHER}`, archived: false },
      { id: OLD, dir: `${ROOT}/.bdk/changes/archive/${OLD}`, archived: true },
    ]);
  });
});

describe("resolveActiveChange", () => {
  const where = { cwd: `${ROOT}/src`, workTree: ROOT };

  it("resolves the Change bound to the current branch", () => {
    const { store, git } = world("feat/login");
    writeMarker(store, ROOT, "feat/login", LIVE);
    expect(resolveActiveChange(store, git, where)).toStrictEqual({
      id: LIVE,
      dir: `${ROOT}/.bdk/changes/${LIVE}`,
      projectRoot: ROOT,
      branch: "feat/login",
    });
  });

  it("refuses without a marker and lists the unarchived Changes", () => {
    const { store, git } = world("feat/login");
    const refusal = resolveActiveChange(store, git, where);
    expect(refusal).toMatchObject({ rule: "policy/no-active-change" });
    const instead = "instead" in refusal ? refusal.instead : [];
    expect(instead).toContain(`bdk change resume ${LIVE}`);
    expect(instead).not.toContain(`bdk change resume ${OLD}`);
  });

  it("says that HEAD is detached", () => {
    const { store, git } = world(undefined);
    expect(resolveActiveChange(store, git, where)).toMatchObject({
      rule: "policy/no-active-change",
      why: expect.stringContaining("detached") as string,
    });
  });

  it("treats a marker naming an archived Change as no binding", () => {
    const { store, git } = world("main");
    writeMarker(store, ROOT, "main", OLD);
    expect(resolveActiveChange(store, git, where)).toMatchObject({
      rule: "policy/no-active-change",
    });
  });

  it("refuses state/change-dir-missing for a marker naming a gone Change", () => {
    const { store, git } = world("main");
    writeMarker(store, ROOT, "main", "2026-09-01-gone");
    const refusal = resolveActiveChange(store, git, where);
    expect(refusal).toMatchObject({ rule: "state/change-dir-missing" });
    expect("instead" in refusal ? refusal.instead : []).toContain("bdk rebuild");
  });

  it("ignores the marker of another branch", () => {
    const { store, git } = world("main");
    writeMarker(store, ROOT, "feat/login", LIVE);
    expect(resolveActiveChange(store, git, where)).toMatchObject({
      rule: "policy/no-active-change",
    });
  });
});
