import { describe, expect, it } from "vitest";

import { CaseFileError, caseFile, parseCases, readCases } from "./cases.ts";

describe("parseCases", () => {
  it("reads a seed and refuses an unknown one, naming the case", () => {
    const [seeded] = parseCases(
      "- id: flat\n  command: /bdk:execute\n  seed: audit-csv\n  expect:\n    - reply: x\n",
      "execute.yaml",
    );
    expect(seeded?.seed).toBe("audit-csv");
    expect(() =>
      parseCases(
        "- id: flat\n  command: /bdk:execute\n  seed: nothing\n  expect:\n    - reply: x\n",
        "execute.yaml",
      ),
    ).toThrow("entry 1 (flat): seed must be one of audit-csv, two-independent-parts");
  });

  it("reads the command, preparation, answers and expectations", () => {
    const cases = parseCases(
      [
        "- id: existing-change",
        "  base: empty",
        '  command: /bdk:change "Add a dark mode toggle"',
        "  prepare:",
        "    - git switch -c work",
        "  answers:",
        "    Branch: Stay on the current branch",
        "  expect:",
        "    - run: change list",
        "      json:",
        "        changes.length: 1",
        "    - run: config check",
        "      exit: 0",
        "    - reply: change status",
      ].join("\n"),
      "change.yaml",
    );
    expect(cases).toEqual([
      {
        id: "existing-change",
        base: "empty",
        command: '/bdk:change "Add a dark mode toggle"',
        prepare: ["git switch -c work"],
        answers: { Branch: "Stay on the current branch" },
        expect: [
          { run: "change list", json: { "changes.length": 1 } },
          { run: "config check", exit: 0 },
          { reply: "change status" },
        ],
      },
    ]);
  });

  it("defaults the base to the fixture and preparation and answers to none", () => {
    const [only] = parseCases(
      "- id: plain\n  command: /bdk:setup\n  expect:\n    - run: doctor\n      json:\n        ok: true\n",
      "setup.yaml",
    );
    expect(only).toEqual({
      id: "plain",
      base: "fixture",
      command: "/bdk:setup",
      prepare: [],
      answers: {},
      expect: [{ run: "doctor", json: { ok: true } }],
    });
  });

  it("names every broken entry in one error", () => {
    const parse = () =>
      parseCases(
        [
          "- id: Bad",
          "  base: repo",
          "  command: setup",
          "  expect: []",
          "- id: ok",
          "  command: /bdk:setup",
          "  expect:",
          "    - run: doctor",
          "      shell: rm -rf .",
          "  extra: 1",
        ].join("\n"),
        "x.yaml",
      );
    expect(parse).toThrow(CaseFileError);
    expect(parse).toThrow(
      /entry 1 \(Bad\): id must be lowercase.*base must be fixture or empty.*command must be a \/bdk: slash command.*expect must be a non-empty list.*entry 2 \(ok\): expect 1: unknown field shell.*entry 2 \(ok\): unknown field extra/,
    );
  });

  it("names broken field types and duplicate ids", () => {
    const parse = () =>
      parseCases(
        [
          "- 7",
          "- id: a",
          "  command: /bdk:setup",
          "  prepare: x",
          "  answers: [1]",
          "  expect:",
          "    - 1",
          "    - reply: ''",
          "      run: doctor",
          "    - run: ''",
          "      exit: x",
          "      json: 1",
          "      match: {a: 1}",
          "- id: a",
          "  command: /bdk:setup",
          "  expect: [{reply: x}]",
          "- id: a",
          "  command: /bdk:setup",
          "  expect: [{reply: x}]",
        ].join("\n"),
        "y.yaml",
      );
    expect(parse).toThrow(
      new RegExp(
        [
          "entry 1 is not a mapping",
          "prepare must be a list",
          "answers must map",
          "expect 1 is not a mapping",
          "expect 2: reply must be a non-empty pattern",
          "expect 2: unknown field run",
          "expect 3: run must name",
          "exit must be an integer",
          "json must map",
          "match must map",
          "entry 4 \\(a\\): id is not unique",
        ].join(".*"),
      ),
    );
  });

  it("refuses an empty file", () => {
    expect(() => parseCases("[]", "e.yaml")).toThrow(/non-empty list/);
  });
});

describe("the case files", () => {
  it.each(["setup", "change"])("%s parses", (skill) => {
    expect(readCases(caseFile(skill)).length).toBeGreaterThanOrEqual(2);
  });
});
