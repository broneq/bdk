// The coverage domain of `bdk evidence coverage` (`kernel-cli/evidence`; T42
// D5): the lcov and Cobertura parsers and the measurement of the lines a
// Change adds, all pure.
import { describe, expect, it } from "vitest";

import { coverageVerdict, measureCoverage, parseCoverage } from "../domain/coverage.ts";
import type { CoverageReport } from "../domain/coverage.ts";

const LCOV = [
  "TN:",
  "SF:src/auth/login.ts",
  "FN:1,login",
  "DA:1,4",
  "DA:2,0",
  "DA:3,1,abc",
  "LF:3",
  "LH:2",
  "end_of_record",
  "SF:/repo/src/mail/send.ts",
  "DA:7,2",
  "end_of_record",
  "",
].join("\n");

const COBERTURA = `<?xml version="1.0" ?>
<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">
<coverage line-rate="0.5" version="7.0">
  <sources><source>/repo</source></sources>
  <packages><package name="auth"><classes>
    <class name="login" filename="src/auth/login.py" line-rate="0.5">
      <methods/>
      <lines>
        <line number="1" hits="3"/>
        <line number="2" hits="0" branch="false"/>
      </lines>
    </class>
    <class name="a&amp;b" filename="src/a&amp;b.py">
      <lines><line number="5" hits="1"/></lines>
    </class>
  </classes></package></packages>
</coverage>
`;

function report(entries: Record<string, Record<number, number>>): CoverageReport {
  return new Map(
    Object.entries(entries).map(([path, lines]) => [
      path,
      new Map(Object.entries(lines).map(([line, hits]) => [Number(line), hits])),
    ]),
  );
}

function lines(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, at) => from + at);
}

describe("parseCoverage", () => {
  it("reads lcov SF and DA records, checksums ignored", () => {
    expect(parseCoverage("lcov", LCOV)).toStrictEqual(
      report({
        "src/auth/login.ts": { 1: 4, 2: 0, 3: 1 },
        "/repo/src/mail/send.ts": { 7: 2 },
      }),
    );
  });

  it("reads Cobertura class filenames and line hits, entities decoded", () => {
    expect(parseCoverage("cobertura", COBERTURA)).toStrictEqual(
      report({ "src/auth/login.py": { 1: 3, 2: 0 }, "src/a&b.py": { 5: 1 } }),
    );
  });

  it("keeps the highest hit count of a line listed twice", () => {
    const text = "SF:a.ts\nDA:1,0\nend_of_record\nSF:a.ts\nDA:1,2\nend_of_record\n";
    expect(parseCoverage("lcov", text)).toStrictEqual(report({ "a.ts": { 1: 2 } }));
  });

  it("refuses a Cobertura file read as lcov, naming lcov and the first bad line", () => {
    expect(parseCoverage("lcov", COBERTURA)).toStrictEqual({
      problem: `not an lcov report: line 1: <?xml version="1.0" ?>`,
    });
  });

  it("refuses an lcov file read as Cobertura", () => {
    expect(parseCoverage("cobertura", LCOV)).toStrictEqual({
      problem: "not a cobertura report: line 1: TN:",
    });
  });

  it.each([
    ["DA before SF", "DA:1,1\n", "line 1: DA:1,1"],
    ["a malformed DA", "SF:a.ts\nDA:x,1\n", "line 2: DA:x,1"],
    ["no SF record", "TN:\n", "line 1: TN:"],
  ])("refuses lcov with %s", (_, text, where) => {
    expect(parseCoverage("lcov", text)).toStrictEqual({ problem: `not an lcov report: ${where}` });
  });

  it("refuses a Cobertura line with a non-numeric hit count, naming its line", () => {
    const text =
      '<coverage>\n<class filename="a.py">\n<line number="1" hits="many"/>\n</class>\n</coverage>\n';
    expect(parseCoverage("cobertura", text)).toStrictEqual({
      problem: 'not a cobertura report: line 3: <line number="1" hits="many"/>',
    });
  });
});

describe("measureCoverage", () => {
  const base = { test: "unit", format: "lcov" as const, projectRoot: "/repo" };

  it("counts only the added lines: a 200-line file at 50 % with 10 added lines all hit is 100 %", () => {
    const hits: Record<number, number> = {};
    for (const line of lines(1, 200)) hits[line] = line <= 100 ? 1 : 0;
    for (const line of lines(150, 159)) hits[line] = 5;
    const summary = measureCoverage({
      ...base,
      min: 90,
      added: new Map([["src/auth/login.ts", lines(150, 159)]]),
      report: report({ "src/auth/login.ts": hits }),
    });
    expect(summary).toMatchObject({ percent: 100, covered: 10, total: 10, unmeasured: [] });
    expect(coverageVerdict(summary)).toBe("pass");
  });

  it("fails 17 of 20 added lines against min 90 and lists the three uncovered lines", () => {
    const hits: Record<number, number> = {};
    for (const line of lines(1, 20)) hits[line] = [4, 9, 17].includes(line) ? 0 : 1;
    const summary = measureCoverage({
      ...base,
      min: 90,
      added: new Map([["src/auth/login.ts", lines(1, 20)]]),
      report: report({ "src/auth/login.ts": hits }),
    });
    expect(summary).toStrictEqual({
      test: "unit",
      format: "lcov",
      min: 90,
      percent: 85,
      covered: 17,
      total: 20,
      files: [{ path: "src/auth/login.ts", covered: 17, total: 20, uncovered: [4, 9, 17] }],
      unmeasured: [],
    });
    expect(coverageVerdict(summary)).toBe("fail");
  });

  it("passes any percent without min and reports it", () => {
    const summary = measureCoverage({
      ...base,
      format: "cobertura",
      added: new Map([["e2e/flow.ts", [1, 2, 3, 4, 5]]]),
      report: report({ "e2e/flow.ts": { 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 } }),
    });
    expect(summary).toMatchObject({ min: null, percent: 40 });
    expect(coverageVerdict(summary)).toBe("pass");
  });

  it("rounds down to one decimal", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([["a.ts", [1, 2, 3]]]),
      report: report({ "a.ts": { 1: 1, 2: 1, 3: 0 } }),
    });
    expect(summary.percent).toBe(66.6);
  });

  it("maps a report path to the changed file it is a path-segment suffix of", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([["kernel/src/log/add.ts", [3]]]),
      report: report({ "src/log/add.ts": { 3: 1 } }),
    });
    expect(summary.files).toStrictEqual([
      { path: "kernel/src/log/add.ts", covered: 1, total: 1, uncovered: [] },
    ]);
  });

  it("maps an absolute report path relative to the project root", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([["src/mail/send.ts", [7]]]),
      report: report({ "/repo/src/mail/send.ts": { 7: 2 } }),
    });
    expect(summary).toMatchObject({ covered: 1, total: 1 });
  });

  it("does not match inside a path segment", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([["src/readd.ts", [1]]]),
      report: report({ "add.ts": { 1: 1 } }),
    });
    expect(summary).toMatchObject({ total: 0, unmeasured: ["src/readd.ts"] });
  });

  it("puts a tie of two changed files with the same tail under unmeasured", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([
        ["api/src/index.ts", [1]],
        ["web/src/index.ts", [1]],
      ]),
      report: report({ "src/index.ts": { 1: 1 } }),
    });
    expect(summary).toMatchObject({
      total: 0,
      files: [],
      unmeasured: ["api/src/index.ts", "web/src/index.ts"],
    });
  });

  it("lets an exact path win over a tail match", () => {
    const summary = measureCoverage({
      ...base,
      added: new Map([
        ["src/index.ts", [1]],
        ["web/src/index.ts", [1]],
      ]),
      report: report({ "src/index.ts": { 1: 1 } }),
    });
    expect(summary).toMatchObject({ total: 1, unmeasured: ["web/src/index.ts"] });
  });

  it("lists a changed file the report does not name under unmeasured, out of total", () => {
    const summary = measureCoverage({
      ...base,
      min: 90,
      added: new Map([
        ["src/auth/login.ts", [1]],
        ["src/mail/send.ts", [1, 2, 3]],
      ]),
      report: report({ "src/auth/login.ts": { 1: 1 } }),
    });
    expect(summary).toMatchObject({ total: 1, unmeasured: ["src/mail/send.ts"] });
  });

  it("answers percent null and pass when no added line is instrumented", () => {
    const summary = measureCoverage({
      ...base,
      min: 90,
      added: new Map([["src/types.ts", [1, 2]]]),
      report: report({ "src/types.ts": { 9: 0 } }),
    });
    expect(summary).toMatchObject({ percent: null, covered: 0, total: 0 });
    expect(coverageVerdict(summary)).toBe("pass");
  });
});
