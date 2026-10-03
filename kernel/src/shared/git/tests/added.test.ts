// The lines a diff adds (`kernel-cli/evidence`, bdk evidence coverage): the
// `git diff --unified=0` parser as a pure function.
import { describe, expect, it } from "vitest";

import { parseAddedLines } from "../index.ts";

describe("parseAddedLines", () => {
  it("lists the added lines of each hunk by the new file's numbering", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -2,0 +3,2 @@ export function a() {",
      "+  one();",
      "+  two();",
      "@@ -10 +12 @@",
      "-old",
      "+new",
      "@@ -20,3 +22,0 @@",
      "-gone",
      "-gone",
      "-gone",
      "",
    ].join("\n");
    expect(parseAddedLines(diff)).toStrictEqual(new Map([["src/a.ts", [3, 4, 12]]]));
  });

  it("reads a new file whole and leaves a deleted file out", () => {
    const diff = [
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,3 @@",
      "+a",
      "+b",
      "+c",
      "diff --git a/src/old.ts b/src/old.ts",
      "deleted file mode 100644",
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-x",
      "-y",
      "",
    ].join("\n");
    expect(parseAddedLines(diff)).toStrictEqual(new Map([["src/new.ts", [1, 2, 3]]]));
  });

  it("does not read a content line starting with +++ as a file header", () => {
    const diff = ["--- a/notes.md", "+++ b/notes.md", "@@ -1,0 +2,1 @@", "+++ b/fake.md", ""].join(
      "\n",
    );
    expect(parseAddedLines(diff)).toStrictEqual(new Map([["notes.md", [2]]]));
  });
});
