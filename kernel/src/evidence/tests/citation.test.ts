// The citation validator (`kernel-cli/evidence`, `evidence record`; T4,
// T23-D8, D47): `file#/pointer`, `file:line` and `file:line=text`, the file
// part optional with one recorded file, never into a file that is not text.
import { describe, expect, it } from "vitest";

import { citationProblem, isText } from "../domain/citation.ts";
import type { CitedFile } from "../domain/citation.ts";

const encode = (text: string) => new TextEncoder().encode(text);

const SUMMARY: CitedFile = {
  given: "out/summary.json",
  text: JSON.stringify({ summary: { failed: 0, "a/b": 1, "m~n": 2 }, list: [10, 20] }),
};
const RUN: CitedFile = { given: "out/run.txt", text: "suite\nlogin\n12 passed, 0 failed\n" };
const PNG: CitedFile = { given: "capture.png", text: undefined };

describe("citationProblem", () => {
  it.each([
    ["summary.json#/summary/failed"],
    ["out/summary.json#/summary/failed"],
    ["summary.json#/list/1"],
    ["summary.json#/summary/a~1b"],
    ["summary.json#/summary/m~0n"],
    ["run.txt:3"],
    ["out/run.txt:1"],
    ["run.txt:3=0 failed"],
    ["run.txt:3=12 passed, 0 failed"],
  ])("resolves %s with two files", (citation) => {
    expect(citationProblem(citation, [SUMMARY, RUN])).toBeUndefined();
  });

  it.each([["#/summary/failed"], ["/summary/failed"]])(
    "resolves %s against the only file",
    (citation) => {
      expect(citationProblem(citation, [SUMMARY])).toBeUndefined();
    },
  );

  it.each([
    ["/tmp/out/run.txt:3=0 failed"],
    ["/tmp/out/summary.json#/summary/failed"],
    ["/tmp/out/run.txt:1"],
  ])("resolves %s against a file given by its absolute path", (citation) => {
    const files = [
      { ...SUMMARY, given: "/tmp/out/summary.json" },
      { ...RUN, given: "/tmp/out/run.txt" },
    ];
    expect(citationProblem(citation, files)).toBeUndefined();
  });

  it("resolves a line without the file part against the only file", () => {
    expect(citationProblem(":3=0 failed", [RUN])).toBeUndefined();
  });

  it("refuses a citation without the file part when several files are recorded", () => {
    expect(citationProblem("/summary/failed", [SUMMARY, RUN])).toContain("names no file");
  });

  it.each([
    ["run.txt:3=2 failed", "run.txt", "line 3 does not contain 2 failed"],
    ["run.txt:4", "run.txt", "has no line 4"],
    ["run.txt:0", "run.txt", "has no line 0"],
    ["summary.json#/summary/passed", "summary.json", "names no value"],
    ["summary.json#/list/2", "summary.json", "names no value"],
    ["summary.json#summary", "summary.json", "not a JSON pointer"],
    ["run.txt#/x", "run.txt", "does not parse as JSON"],
    ["capture.png:1", "capture.png", "not text"],
    ["other.json#/x", "other.json", "is not a recorded file"],
    ["run.txt", "run.txt", "is not a citation"],
  ])("refuses %s naming %s", (citation, file, why) => {
    const problem = citationProblem(citation, [SUMMARY, RUN, PNG]);
    expect(problem).toContain(citation);
    expect(problem).toContain(file);
    expect(problem).toContain(why);
  });

  it("refuses a pointer into a binary file", () => {
    expect(citationProblem("#/x", [PNG])).toContain("not text");
  });
});

describe("isText", () => {
  it.each([
    ["plain UTF-8", encode("12 passed ✓\n"), true],
    ["empty", encode(""), true],
    ["a NUL byte", encode("a\0b"), false],
    ["invalid UTF-8", Uint8Array.from([0xff, 0xfe, 0x41]), false],
  ])("answers %s", (_, bytes, expected) => {
    expect(isText(bytes)).toBe(expected);
  });
});
