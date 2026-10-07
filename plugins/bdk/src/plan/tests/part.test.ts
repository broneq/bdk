import { describe, expect, it } from "vitest";

import { countTasks, partId, readPart } from "../domain/part.ts";

// Part files and their measures, spec `bdk-cli/plan`, "Part files" and "Part limits".

const front = (id: string, extra = ""): string =>
  `---\nid: ${id}\ndepends-on: []\nisolation: worktree\nfiles:\n  - src/a.ts\n${extra}---\n`;

const TASKS = "\n## Tasks\n\n1. first\n2. second\n";

describe("partId", () => {
  it("takes two digits and .md", () => {
    expect(partId("01.md")).toBe("01");
    expect(partId("1.md")).toBeUndefined();
    expect(partId("001.md")).toBeUndefined();
    expect(partId("02-login.md")).toBeUndefined();
    expect(partId("01.txt")).toBeUndefined();
  });
});

describe("readPart", () => {
  it("reads a valid part", () => {
    const text = `${front('"01"')}\n# Part 01: x\n${TASKS}`;
    expect(readPart("01", text)).toEqual({
      id: "01",
      isolation: "worktree",
      dependsOn: [],
      files: ["src/a.ts"],
      tasks: 2,
      bytes: new TextEncoder().encode(text).length,
      faults: [],
    });
  });

  it("counts bytes, not characters", () => {
    const text = `${front('"01"')}ż${TASKS}`;
    expect(readPart("01", text).bytes).toBe(text.length + 1);
  });

  it("reports a missing frontmatter", () => {
    const part = readPart("01", `# Part 01${TASKS}`);
    expect(part.faults).toEqual(["has no frontmatter between --- lines"]);
    expect(part).toMatchObject({ isolation: null, dependsOn: [], files: [], tasks: 2 });
  });

  it("reports frontmatter that is not YAML or not a mapping", () => {
    expect(readPart("01", "---\nid: [\n---\n").faults[0]).toMatch(/^frontmatter is not YAML: /);
    expect(readPart("01", "---\n- a\n---\n").faults).toEqual(["frontmatter is not a mapping"]);
    expect(readPart("01", "---\n---\n").faults).toEqual(["frontmatter is not a mapping"]);
  });

  it("names an unquoted id and an id that is not the stem", () => {
    expect(readPart("01", front("01")).faults).toEqual(['id is 1, not the quoted file stem "01"']);
    expect(readPart("01", front('"02"')).faults).toEqual([
      'id is "02", not the quoted file stem "01"',
    ]);
    expect(
      readPart("01", "---\ndepends-on: []\nisolation: shared\nfiles: [a]\n---\n").faults,
    ).toEqual(['id is missing, not the quoted file stem "01"']);
  });

  it("checks depends-on and isolation", () => {
    const text = '---\nid: "02"\ndepends-on: [01]\nisolation: parallel\nfiles: [a]\n---\n';
    expect(readPart("02", text).faults).toEqual([
      "depends-on is not a list of quoted part ids",
      "isolation is parallel, not worktree or shared",
    ]);
    const missing = readPart("02", '---\nid: "02"\nfiles: [a]\n---\n');
    expect(missing.faults).toEqual([
      "depends-on is missing; use [] for none",
      "isolation is missing, not worktree or shared",
    ]);
    expect(missing.isolation).toBeNull();
  });

  it("keeps the readable keys of a part with faults", () => {
    const part = readPart(
      "02",
      '---\nid: "02"\ndepends-on: ["01"]\nisolation: x\nfiles: [a]\n---\n',
    );
    expect(part).toMatchObject({ dependsOn: ["01"], files: ["a"], isolation: null });
  });

  it("checks every path in files", () => {
    const text = [
      "---",
      'id: "01"',
      "depends-on: []",
      "isolation: worktree",
      "files:",
      "  - src/**/*.ts",
      "  - src/api/",
      "  - /etc/passwd",
      "  - ../other/x.ts",
      "  - app/[id]/page.tsx",
      "  - app/[id]/page.tsx",
      "---",
    ].join("\n");
    const part = readPart("01", text);
    expect(part.faults).toEqual([
      "files holds src/**/*.ts, a glob, not a file path",
      "files holds src/api/, a directory, not a file path",
      "files holds /etc/passwd, an absolute path, not a repository-relative one",
      "files holds ../other/x.ts, a path with a .. segment",
    ]);
    expect(part.files).toEqual([
      "src/**/*.ts",
      "src/api/",
      "/etc/passwd",
      "../other/x.ts",
      "app/[id]/page.tsx",
    ]);
  });

  it("rejects files that is missing, empty or not a list of strings", () => {
    const base = '---\nid: "01"\ndepends-on: []\nisolation: worktree\n';
    expect(readPart("01", `${base}---\n`).faults).toEqual(["files is missing"]);
    expect(readPart("01", `${base}files: []\n---\n`).faults).toEqual(["files is empty"]);
    expect(readPart("01", `${base}files: src/a.ts\n---\n`).faults).toEqual([
      "files is not a list of paths",
    ]);
  });
});

describe("countTasks", () => {
  it("counts numbered items under ## Tasks up to the next level-two heading", () => {
    const text = [
      "## Goal",
      "1. not a task",
      "## Tasks",
      "1. one",
      "   1. nested, not counted",
      "2) two",
      "### Detail",
      "3. three",
      "10. ten",
      "## After",
      "4. not a task",
    ].join("\n");
    expect(countTasks(text)).toBe(4);
  });

  it("skips fenced code blocks", () => {
    const text = ["## Tasks", "1. one", "```", "2. in code", "## Not a heading", "```", "2. two"];
    expect(countTasks(text.join("\n"))).toBe(2);
  });

  it("stops at a level-one heading and ignores a list item without a space", () => {
    expect(countTasks("## Tasks\n1.no\n1. yes\n# Next\n2. no")).toBe(1);
  });

  it("is zero without a Tasks section", () => {
    expect(countTasks("## Goal\n1. a\n")).toBe(0);
  });
});
