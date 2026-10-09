import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import type { Entry, Files } from "../../shared/fs/index.ts";
import { GitError } from "../../shared/git/index.ts";
import { groups } from "../use-cases/groups.ts";
import { scope } from "../use-cases/scope.ts";
import type { GitDeps } from "../use-cases/deps.ts";

// The use cases of spec `bdk-cli/git` against a scripted git and an in-memory file system.
// Real git runs in plugins/bdk/tests/git.test.ts.

const HEAD = "1".repeat(40);
const BASE = "2".repeat(40);
const MERGE_BASE = "3".repeat(40);
const ROUND = "4".repeat(40);

/** git answers keyed by the argument list; a number is a failing exit status. */
type Script = Record<string, string | number>;

const DIFF = "--no-ext-diff --no-relative --no-renames -z";

function happy(anchor = MERGE_BASE): Script {
  return {
    "rev-parse --is-inside-work-tree": "true\n",
    "rev-parse --verify --quiet HEAD^{commit}": `${HEAD}\n`,
    "rev-parse --verify --quiet main^{commit}": `${BASE}\n`,
    [`merge-base ${HEAD} ${BASE}`]: `${MERGE_BASE}\n`,
    [`diff --numstat ${DIFF} ${anchor} ${HEAD}`]:
      "1\t0\tsrc/b.ts\0-\t-\timg/a.png\0" + "0\t4\tsrc/old.ts\0" + "2\t2\tsrc/a.ts\0",
    [`diff --name-only --diff-filter=D ${DIFF} ${anchor} ${HEAD}`]: "src/old.ts\0",
    [`diff --name-only ${DIFF} HEAD`]: "src/c.ts\0",
    [`diff --cached --name-only ${DIFF}`]: "src/c.ts\0src/d.ts\0",
  };
}

class MemoryFiles implements Files {
  readonly written = new Map<string, string>();
  private readonly tree: Record<string, string>;

  constructor(tree: Record<string, string>) {
    this.tree = tree;
  }

  readText(path: string): string | undefined {
    return this.written.get(path) ?? this.tree[path];
  }

  list(dir: string): readonly Entry[] | undefined {
    const prefix = `${dir}/`;
    const names = new Map<string, boolean>();
    for (const path of [...Object.keys(this.tree), ...this.written.keys()]) {
      if (!path.startsWith(prefix)) continue;
      const [name = "", ...rest] = path.slice(prefix.length).split("/");
      names.set(name, (names.get(name) ?? false) || rest.length > 0);
    }
    if (names.size === 0) return undefined;
    return [...names].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, dir]) => ({ name, dir }));
  }

  writeText(path: string, text: string): void {
    this.written.set(path, text);
  }

  appendText(path: string, text: string): void {
    this.written.set(path, (this.readText(path) ?? "") + text);
  }
}

function deps(script: Script, tree: Record<string, string> = {}): GitDeps & { files: MemoryFiles } {
  return {
    cwd: "/repo",
    files: new MemoryFiles(tree),
    git(cwd, args) {
      expect(cwd).toBe("/repo");
      const answer = script[args.join(" ")];
      if (answer === undefined) throw new Error(`unscripted git ${args.join(" ")}`);
      if (typeof answer === "number") throw new GitError(args, answer, "fatal: scripted");
      return answer;
    },
  };
}

function code(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof CliError) return error.code;
    throw error;
  }
  return undefined;
}

describe("scope", () => {
  it("covers the merge base to HEAD and names binary, deleted and dirty files", () => {
    expect(scope(deps(happy()), { base: "main" })).toEqual({
      base: "main",
      anchor: { kind: "base", sha: MERGE_BASE },
      head: HEAD,
      range: `${MERGE_BASE}..${HEAD}`,
      files: ["src/a.ts", "src/b.ts"],
      binary: ["img/a.png"],
      deleted: ["src/old.ts"],
      dirty: ["src/c.ts", "src/d.ts"],
    });
  });

  it("starts after the last finished round and ignores a crashed one", () => {
    const script = { ...happy(ROUND), [`merge-base --is-ancestor ${ROUND} ${HEAD}`]: "" };
    const tree = {
      "/repo/run/review/round-1/review.md": "",
      "/repo/run/review/round-1/groups.json": JSON.stringify({ head: ROUND }),
      "/repo/run/review/round-2/groups.json": JSON.stringify({ head: HEAD }),
    };
    expect(scope(deps(script, tree), { base: "main", rounds: "run/review" }).anchor).toEqual({
      kind: "round",
      sha: ROUND,
      round: 1,
    });
  });

  it("treats a missing rounds directory as no finished round", () => {
    expect(scope(deps(happy()), { base: "main", rounds: "run/review" }).anchor).toEqual({
      kind: "base",
      sha: MERGE_BASE,
    });
  });

  it.each([
    ["no record", {}, /round 3 has no groups.json with a valid head/],
    ["an error object", { "/r/round-3/groups.json": '{"error":{}}' }, /no groups.json/],
    [
      "a head that is no ancestor",
      { "/r/round-3/groups.json": JSON.stringify({ head: ROUND }) },
      /round 3 recorded 4444444, which is not an ancestor of HEAD/,
    ],
  ])("falls back to the merge base for %s", (_, record, why) => {
    const script = { ...happy(), [`merge-base --is-ancestor ${ROUND} ${HEAD}`]: 1 };
    const tree = { "/r/round-3/review.md": "# Report", ...record };
    const { anchor } = scope(deps(script, tree), { base: "main", rounds: "/r" });
    expect(anchor).toMatchObject({ kind: "base", sha: MERGE_BASE });
    expect(anchor.fallback).toMatch(why);
  });

  it("falls back when the recorded head names no commit", () => {
    const script = { ...happy(), [`merge-base --is-ancestor ${ROUND} ${HEAD}`]: 128 };
    const tree = {
      "/r/round-1/review.md": "",
      "/r/round-1/groups.json": JSON.stringify({ head: ROUND }),
    };
    expect(scope(deps(script, tree), { base: "main", rounds: "/r" }).anchor.fallback).toMatch(
      /which names no commit/,
    );
  });

  it("reports env/not-a-repo outside a work tree", () => {
    expect(
      code(() => scope(deps({ "rev-parse --is-inside-work-tree": 128 }), { base: "main" })),
    ).toBe("env/not-a-repo");
    expect(
      code(() => scope(deps({ "rev-parse --is-inside-work-tree": "false\n" }), { base: "main" })),
    ).toBe("env/not-a-repo");
  });

  it("reports env/no-head without a commit", () => {
    const script = { ...happy(), "rev-parse --verify --quiet HEAD^{commit}": 1 };
    expect(code(() => scope(deps(script), { base: "main" }))).toBe("env/no-head");
  });

  it("reports usage/invalid-argument for an unknown base, an option as base, no merge base", () => {
    const unknown = { ...happy(), "rev-parse --verify --quiet nope^{commit}": 1 };
    expect(code(() => scope(deps(unknown), { base: "nope" }))).toBe("usage/invalid-argument");
    expect(code(() => scope(deps(happy()), { base: "--all" }))).toBe("usage/invalid-argument");
    const unrelated = { ...happy(), [`merge-base ${HEAD} ${BASE}`]: 1 };
    expect(code(() => scope(deps(unrelated), { base: "main" }))).toBe("usage/invalid-argument");
  });

  it("passes on an unexpected error", () => {
    const broken = deps(happy());
    const failing: GitDeps = {
      ...broken,
      git: () => {
        throw new TypeError("boom");
      },
    };
    expect(() => scope(failing, { base: "main" })).toThrow(TypeError);
  });
});

describe("groups", () => {
  const plan = {
    "/repo/plan/parts/01.md": "---\nfiles:\n  - src/a.ts\n---\n",
    "/repo/plan/parts/notes.md": "not a part",
  };

  it("groups by part and records the result when asked", () => {
    const d = deps(happy(), plan);
    const result = groups(d, {
      base: "main",
      plan: "plan/parts",
      maxFiles: 30,
      record: "run/review/round-1",
    });
    expect(result.groups).toEqual([
      { id: "p01", kind: "part", part: "01", files: ["src/a.ts"] },
      { id: "unplanned", kind: "unplanned", files: ["src/b.ts"] },
      { id: "integration", kind: "integration", files: ["src/a.ts", "src/b.ts"] },
    ]);
    expect(d.files.written.get("/repo/run/review/round-1/groups.json")).toBe(
      `${JSON.stringify(result)}\n`,
    );
  });

  it("groups by module without a plan and writes nothing without --record", () => {
    const d = deps(happy());
    expect(groups(d, { base: "main", maxFiles: 30 }).groups.map((g) => g.id)).toEqual([
      "m1",
      "integration",
    ]);
    expect(d.files.written.size).toBe(0);
  });

  it("reports env/plan-missing and env/plan-invalid, and writes no record", () => {
    const missing = deps(happy());
    expect(
      code(() => groups(missing, { base: "main", plan: "none", maxFiles: 30, record: "r" })),
    ).toBe("env/plan-missing");
    const invalid = deps(happy(), { "/repo/plan/03.md": "---\nfiles: src/a.ts\n---\n" });
    let message = "";
    try {
      groups(invalid, { base: "main", plan: "plan", maxFiles: 30, record: "r" });
    } catch (error) {
      message = `${(error as CliError).code} ${(error as CliError).message}`;
    }
    expect(message).toMatch(/^env\/plan-invalid .*03\.md/);
    expect(missing.files.written.size + invalid.files.written.size).toBe(0);
  });
});
