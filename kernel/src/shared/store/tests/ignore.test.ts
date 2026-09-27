import { describe, expect, it } from "vitest";

import type { Git, GitResult } from "../../git/index.ts";
import { KernelRefusal, refuse } from "../../refusal/index.ts";
import { ensureIgnored, IGNORED_PATHS } from "../ignore.ts";
import { memoryStore } from "../store.ts";

const ROOT = "/repo";
const GITIGNORE = `${ROOT}/.gitignore`;

/** A git whose check-ignore answers 0 for the paths in `ignored`, 1 otherwise. */
function gitIgnoring(ignored: readonly string[]): Git & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    run(args): Promise<GitResult> {
      calls.push([...args]);
      const path = args.at(-1) ?? "";
      return Promise.resolve({ code: ignored.includes(path) ? 0 : 1, stdout: "", stderr: "" });
    },
    currentBranch: () => "main",
  };
}

const noGit: Git = {
  run: () =>
    Promise.reject(new KernelRefusal(refuse("runtime/git-missing", "no git", ["install git"]))),
  currentBranch: () => undefined,
};

describe("ensureIgnored", () => {
  it("names exactly the two paths", () => {
    expect(IGNORED_PATHS).toStrictEqual(["/.bdk/.machine/", "/.bdk/settings.local.yaml"]);
  });

  it("creates .gitignore with both lines in an empty repository", async () => {
    const store = memoryStore();
    const git = gitIgnoring([]);
    expect(await ensureIgnored(store, git, ROOT)).toStrictEqual([...IGNORED_PATHS]);
    expect(store.read(GITIGNORE)).toBe("/.bdk/.machine/\n/.bdk/settings.local.yaml\n");
    expect(git.calls[0]).toStrictEqual(["check-ignore", "--no-index", "-q", ".bdk/.machine/"]);
  });

  it("appends after existing lines, adding the missing newline", async () => {
    const store = memoryStore({ [GITIGNORE]: "node_modules/" });
    await ensureIgnored(store, gitIgnoring([]), ROOT);
    expect(store.read(GITIGNORE)).toBe(
      "node_modules/\n/.bdk/.machine/\n/.bdk/settings.local.yaml\n",
    );
  });

  it("skips a path another rule already covers, e.g. in .git/info/exclude", async () => {
    const store = memoryStore();
    await ensureIgnored(store, gitIgnoring([".bdk/.machine/"]), ROOT);
    expect(store.read(GITIGNORE)).toBe("/.bdk/settings.local.yaml\n");
  });

  it("never repeats a line that is present", async () => {
    const store = memoryStore({ [GITIGNORE]: "/.bdk/.machine/\n" });
    await ensureIgnored(store, gitIgnoring([]), ROOT);
    expect(store.read(GITIGNORE)).toBe("/.bdk/.machine/\n/.bdk/settings.local.yaml\n");
  });

  it("is idempotent", async () => {
    const store = memoryStore();
    await ensureIgnored(store, gitIgnoring([]), ROOT);
    const first = store.read(GITIGNORE);
    expect(await ensureIgnored(store, gitIgnoring([]), ROOT)).toStrictEqual([]);
    expect(store.read(GITIGNORE)).toBe(first);
  });

  it("falls back to reading .gitignore without git", async () => {
    const store = memoryStore({ [GITIGNORE]: "/.bdk/settings.local.yaml\n" });
    expect(await ensureIgnored(store, noGit, ROOT)).toStrictEqual(["/.bdk/.machine/"]);
    expect(store.read(GITIGNORE)).toBe("/.bdk/settings.local.yaml\n/.bdk/.machine/\n");
  });
});
