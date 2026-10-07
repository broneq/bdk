// `bdk measure` on injected git output (design D-11 of T20): aggregation,
// modules, exclusions, renames, determinism and range validation.
import { describe, expect, it } from "vitest";

import type { Git, GitResult } from "../../shared/git/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { aggregate, fileStats, moduleOf, parseRange } from "../domain/measure.ts";
import { renderMeasure } from "../render/measure.ts";
import { measure, rangeStats } from "../use-cases/measure.ts";

const line = (added: string, removed: string, path: string): string =>
  `${added}\t${removed}\t${path}\0`;
const rename = (added: string, removed: string, from: string, to: string): string =>
  `${added}\t${removed}\t\0${from}\0${to}\0`;

describe("aggregate", () => {
  it("sums files, added, removed and lines; a binary file counts zero lines", () => {
    const output =
      line("10", "2", "src/auth/login.ts") +
      line("-", "-", "assets/logo.png") +
      line("3", "0", "README.md");
    expect(aggregate("main", fileStats(output))).toEqual({
      range: "main",
      files: 3,
      added: 13,
      removed: 2,
      lines: 15,
      modules: ["README.md", "assets", "src/auth"],
    });
  });

  it("excludes every path under a .bdk directory", () => {
    const output =
      line("1", "1", "src/a.ts") +
      line("20", "0", ".bdk/changes/2026-09-25-x/log/20260925T090000Z-decision-L-aaaaaaaa.md") +
      line("5", "0", "packages/web/.bdk/settings.yaml");
    expect(aggregate("HEAD", fileStats(output))).toMatchObject({
      files: 1,
      lines: 2,
      modules: ["src"],
    });
  });

  it("counts a rename once under its new path", () => {
    const output =
      rename("2", "1", "src/old/a.ts", "lib/new/a.ts") + line("1", "0", "lib/new/b.ts");
    expect(aggregate("main", fileStats(output))).toMatchObject({
      files: 2,
      lines: 4,
      modules: ["lib/new"],
    });
  });

  it("gives the same output for the same input in any order", () => {
    const parts = [
      line("1", "0", "b/x/y.ts"),
      line("2", "3", "a/b.ts"),
      rename("0", "0", "c", "d/e/f.ts"),
    ];
    const first = JSON.stringify(aggregate("main", fileStats(parts.join(""))));
    const second = JSON.stringify(aggregate("main", fileStats([...parts].reverse().join(""))));
    expect(second).toBe(first);
  });

  it("measures an empty diff as zero", () => {
    expect(aggregate("HEAD", fileStats(""))).toEqual({
      range: "HEAD",
      files: 0,
      added: 0,
      removed: 0,
      lines: 0,
      modules: [],
    });
  });
});

describe("fileStats", () => {
  it("flags a binary file, whose counts are -, and keeps the counts of the others", () => {
    const output = line("10", "2", "src/a.ts") + line("-", "-", "snap/a.png");
    expect(fileStats(output)).toStrictEqual([
      { path: "snap/a.png", added: 0, removed: 0, binary: true },
      { path: "src/a.ts", added: 10, removed: 2, binary: false },
    ]);
  });

  it("names a renamed binary file by its new path", () => {
    expect(fileStats(rename("-", "-", "old/a.png", "new/a.png"))).toStrictEqual([
      { path: "new/a.png", added: 0, removed: 0, binary: true },
    ]);
  });
});

describe("moduleOf", () => {
  it.each([
    ["README.md", "README.md"],
    ["src/a.ts", "src"],
    ["src/auth/login.ts", "src/auth"],
    ["src/auth/deep/login.ts", "src/auth"],
  ])("%s is in %s", (path, module) => {
    expect(moduleOf(path)).toBe(module);
  });
});

describe("parseRange", () => {
  it.each([
    ["main", ["main"]],
    ["main..HEAD", ["main", "HEAD"]],
    ["origin/main..feat/x", ["origin/main", "feat/x"]],
    ["HEAD~2", ["HEAD~2"]],
  ])("accepts %s", (range, refs) => {
    expect(parseRange(range)).toEqual(refs);
  });

  it.each([
    "",
    "main..",
    "..HEAD",
    "a...b",
    "a..b..c",
    "--output=x",
    "main\tx",
    "a b",
    "a/.hidden",
  ])("rejects %j", (range) => {
    expect(parseRange(range)).toBeUndefined();
  });
});

/** A git that knows some refs and answers `diff` with fixed output. */
function fakeGit(refs: readonly string[], diff: GitResult): Git & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    currentBranch: () => "main",
    run(args) {
      calls.push([...args]);
      if (args[0] === "rev-parse") {
        const ref = String(args[3]).replace("^{commit}", "");
        return Promise.resolve({ code: refs.includes(ref) ? 0 : 1, stdout: "", stderr: "" });
      }
      return Promise.resolve(diff);
    },
  };
}

const OK: GitResult = { code: 0, stdout: line("4", "1", "src/auth/a.ts"), stderr: "" };

describe("measure", () => {
  it("measures HEAD by default: the working tree against HEAD", async () => {
    const git = fakeGit(["HEAD"], OK);
    expect(await measure({ git }, "/repo")).toMatchObject({ range: "HEAD", files: 1, lines: 5 });
    expect(git.calls.at(-1)).toEqual([
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "HEAD",
      "--",
    ]);
  });

  it("passes a committed range through as <base>..<head>", async () => {
    const git = fakeGit(["main", "HEAD"], OK);
    await measure({ git }, "/repo", "main..HEAD");
    expect(git.calls.at(-1)).toContain("main..HEAD");
  });

  it("refuses a malformed range with input/invalid-argument before running git", async () => {
    const git = fakeGit([], OK);
    const outcome = (await measure({ git }, "/repo", "--output=/tmp/x")) as Refusal;
    expect(outcome.rule).toBe("input/invalid-argument");
    expect(git.calls).toEqual([]);
  });

  it("refuses an unknown ref with input/invalid-argument", async () => {
    const outcome = (await measure(
      { git: fakeGit(["main"], OK) },
      "/repo",
      "main..nope",
    )) as Refusal;
    expect(outcome.rule).toBe("input/invalid-argument");
    expect(outcome.why).toContain("nope");
  });

  it("refuses when git diff itself fails", async () => {
    const git = fakeGit(["main"], { code: 128, stdout: "", stderr: "fatal: bad object\n" });
    const outcome = (await measure({ git }, "/repo", "main")) as Refusal;
    expect(outcome.rule).toBe("input/invalid-argument");
    expect(outcome.why).toContain("fatal: bad object");
  });
});

describe("rangeStats", () => {
  it("gives the per-file rows and their aggregate from one git call", async () => {
    const git = fakeGit([], {
      code: 0,
      stdout: line("4", "1", "src/auth/a.ts") + line("-", "-", "snap/a.png"),
      stderr: "",
    });
    const outcome = await rangeStats({ git }, "/repo", "B", "H");
    expect(outcome).toStrictEqual({
      files: [
        { path: "snap/a.png", added: 0, removed: 0, binary: true },
        { path: "src/auth/a.ts", added: 4, removed: 1, binary: false },
      ],
      report: {
        range: "B..H",
        files: 2,
        added: 4,
        removed: 1,
        lines: 5,
        modules: ["snap", "src/auth"],
      },
    });
    expect(git.calls).toHaveLength(1);
  });
});

describe("renderMeasure", () => {
  it("prints one line of signals", () => {
    expect(
      renderMeasure({
        range: "main",
        files: 6,
        added: 180,
        removed: 42,
        lines: 222,
        modules: ["src/auth", "src/mail"],
      }),
    ).toBe("main: 6 files, +180 -42 (222 lines), 2 modules: src/auth, src/mail\n");
    expect(
      renderMeasure({ range: "HEAD", files: 1, added: 1, removed: 0, lines: 1, modules: ["src"] }),
    ).toBe("HEAD: 1 file, +1 -0 (1 lines), 1 module: src\n");
  });
});
