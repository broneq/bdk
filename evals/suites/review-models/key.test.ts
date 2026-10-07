import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { seedPatches } from "../stages/seeds.ts";
import { writePreimages } from "../stages/testing.ts";
import {
  KEY_FILE,
  hunkRanges,
  keyProblems,
  parseKey,
  patchedFiles,
  readKey,
  readPatch,
} from "./key.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" });
}

const KEY = `seed: executed-two-parts
patch: defects.patch
defects:
  - id: one
    class: logic
    file: src/a.ts
    lines: [3, 4]
    summary: the first defect
`;

const PATCH = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -2,3 +2,3 @@ x
 a
-b
+c
 d
`;

describe("parseKey", () => {
  it("reads the seed, the patch and the defects", () => {
    expect(parseKey(KEY, "key.yaml")).toStrictEqual({
      seed: "executed-two-parts",
      patch: "defects.patch",
      defects: [
        { id: "one", class: "logic", file: "src/a.ts", lines: [3, 4], summary: "the first defect" },
      ],
    });
  });

  it("refuses an unknown seed, naming the known ones", () => {
    expect(() => parseKey(KEY.replace("executed-two-parts", "nowhere"), "key.yaml")).toThrow(
      /key\.yaml: seed must be one of .*executed-two-parts/,
    );
  });

  it("names every broken field in one error", () => {
    const broken = `seed: executed
patch: ""
defects:
  - id: Bad
    class: style
    file: ""
    lines: [5, 2]
    summary: ""
  - id: dup
    class: logic
    file: a
    lines: [1, 1]
    summary: s
  - id: dup
    class: logic
    file: a
    lines: [1, 1]
    summary: s
  - plain
`;
    expect(() => parseKey(broken, "k")).toThrow(
      new RegExp(
        [
          "patch must name a file",
          "defect 1: id must be",
          "defect 1: class must be one of logic, test-gap, integration",
          "defect 1: file must be a path",
          "defect 1: lines must be",
          "defect 1: summary must be",
          "defect 4 is not a mapping",
          "dup: id is not unique",
        ].join(".*"),
      ),
    );
    expect(() => parseKey("- a\n", "k")).toThrow(/the key is a mapping/);
    expect(() => parseKey("seed: executed\npatch: p\n", "k")).toThrow(
      /defects must be a non-empty list/,
    );
  });
});

describe("keyProblems", () => {
  const key = parseKey(KEY, "key.yaml");

  it("reads the new-side range of every hunk", () => {
    expect(hunkRanges(PATCH)).toStrictEqual(new Map([["src/a.ts", [[2, 4]]]]));
    expect(hunkRanges("+++ b/x\n@@ -1 +1 @@\n-a\n+b\n")).toStrictEqual(new Map([["x", [[1, 1]]]]));
  });

  it("names a file of a binary section, with no range", () => {
    const binary =
      "diff --git a/s/a.png b/s/a.png\nnew file mode 100644\nindex 0..1\nGIT binary patch\nliteral 1\nzc\n\n";
    expect(hunkRanges(binary)).toStrictEqual(new Map([["s/a.png", []]]));
    expect(patchedFiles([binary, PATCH])).toStrictEqual(new Set(["s/a.png", "src/a.ts"]));
  });

  it("accepts a defect in a delivered file at a hunk of the patch", () => {
    expect(keyProblems(key, PATCH, new Set(["src/a.ts"]))).toStrictEqual([]);
  });

  it("names a file the seed does not deliver, the patch does not change, or lines off the hunks", () => {
    expect(keyProblems(key, PATCH, new Set())).toStrictEqual([
      "one: src/a.ts is not a file the seed executed-two-parts delivers",
    ]);
    expect(
      keyProblems(key, PATCH.replaceAll("src/a.ts", "src/b.ts"), new Set(["src/a.ts"])),
    ).toStrictEqual(["one: the patch does not change src/a.ts"]);
    expect(keyProblems(key, PATCH.replace("+2,3", "+20,3"), new Set(["src/a.ts"]))).toStrictEqual([
      "one: lines 3-4 touch no hunk of the patch in src/a.ts",
    ]);
  });
});

describe("the answer key", () => {
  const key = readKey(KEY_FILE);
  const tasks = seedPatches(key.seed).map((file) => readFileSync(file, "utf8"));

  it("names every defect class, at hunks of its patch, in files its seed delivers", () => {
    expect(new Set(key.defects.map((defect) => defect.class))).toStrictEqual(
      new Set(["logic", "test-gap", "integration"]),
    );
    expect(keyProblems(key, readPatch(key), patchedFiles(tasks))).toStrictEqual([]);
  });

  it("applies on top of the seed's task patches, and every key file exists after it", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-review-models-key-"));
    dirs.push(dir);
    git(dir, "init", "-q");
    writePreimages(dir, tasks);
    for (const patch of [...tasks, readPatch(key)]) {
      execFileSync("git", ["apply", "-"], { cwd: dir, env: GIT_ENV, input: patch });
    }
    for (const defect of key.defects) expect(existsSync(join(dir, defect.file))).toBe(true);
  });
});
