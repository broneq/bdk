import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// The ADR log stays uniform and its enforcer lists stay honest (#436): every ADR in docs/adr/
// carries `status`, `date`, `decision-makers` and `enforced-by` in its frontmatter, each
// `enforced-by` entry is `none` or a repository path that exists, and no two ADRs share a number.

const root = join(import.meta.dirname, "..");
const ADR_DIR = "docs/adr";
const REQUIRED = ["status", "date", "decision-makers", "enforced-by"];

interface Adr {
  file: string;
  text: string;
}

function problems(adrs: Adr[], exists: (path: string) => boolean): string[] {
  return [...adrs.flatMap((adr) => fieldProblems(adr, exists)), ...duplicateNumbers(adrs)];
}

function duplicateNumbers(adrs: Adr[]): string[] {
  const byNumber = new Map<string, string[]>();
  for (const { file } of adrs) {
    const number = /^(\d+)-/.exec(file)?.[1] ?? file;
    byNumber.set(number, [...(byNumber.get(number) ?? []), file]);
  }
  return [...byNumber]
    .filter(([, files]) => files.length > 1)
    .map(([number, files]) => `${files.join(", ")}: share number ${number}`);
}

function fieldProblems(adr: Adr, exists: (path: string) => boolean): string[] {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(adr.text)?.[1];
  const fields = (frontmatter === undefined ? null : parse(frontmatter)) as Record<
    string,
    unknown
  > | null;
  const missing = REQUIRED.filter((field) => fields?.[field] === undefined).map(
    (field) => `${adr.file}: missing ${field}`,
  );
  return [...missing, ...enforcerProblems(adr.file, fields?.["enforced-by"], exists)];
}

function enforcerProblems(
  file: string,
  enforcedBy: unknown,
  exists: (path: string) => boolean,
): string[] {
  if (enforcedBy === undefined || enforcedBy === "none") return [];
  const isPathList =
    Array.isArray(enforcedBy) &&
    enforcedBy.length > 0 &&
    enforcedBy.every((entry) => typeof entry === "string" && entry !== "none");
  if (!isPathList) {
    return [`${file}: enforced-by must be none or a non-empty list of repository paths`];
  }
  return (enforcedBy as string[])
    .filter((path) => !exists(path))
    .map((path) => `${file}: enforced-by ${path} does not exist`);
}

const valid = (enforcedBy: string) =>
  `---\nstatus: accepted\ndate: 2026-10-29\ndecision-makers: broneq\nenforced-by: ${enforcedBy}\n---\n\n# ADR\n`;
const anyPath = () => true;

describe("ADR format check", () => {
  it("passes a complete ADR", () => {
    expect(problems([{ file: "0001-a.md", text: valid("none") }], anyPath)).toEqual([]);
  });

  it.each(REQUIRED)("fails an ADR without %s", (field) => {
    const text = valid("none").replace(new RegExp(`^${field}:.*\\n`, "m"), "");
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
      `0001-a.md: missing ${field}`,
    ]);
  });

  it("fails an ADR without frontmatter", () => {
    expect(problems([{ file: "0001-a.md", text: "# ADR\n" }], anyPath)).toHaveLength(4);
  });

  it("passes an enforced-by list of existing paths", () => {
    const text = valid("\n  - tests/a.test.ts\n  - .github/workflows/pr.yml");
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([]);
  });

  it("fails an enforced-by path that does not exist", () => {
    const text = valid("\n  - tests/a.test.ts\n  - tests/gone.test.ts");
    const exists = (path: string) => path === "tests/a.test.ts";
    expect(problems([{ file: "0001-a.md", text }], exists)).toEqual([
      "0001-a.md: enforced-by tests/gone.test.ts does not exist",
    ]);
  });

  it.each([["[]"], ["[none, tests/a.test.ts]"], ["[42]"], ["yes"]])(
    "fails enforced-by %s, which is neither none nor a list of paths",
    (value) => {
      expect(problems([{ file: "0001-a.md", text: valid(value) }], anyPath)).toEqual([
        "0001-a.md: enforced-by must be none or a non-empty list of repository paths",
      ]);
    },
  );

  it("fails two ADRs that share a number", () => {
    const adrs = ["0001-a.md", "0002-b.md", "0002-c.md"].map((file) => ({
      file,
      text: valid("none"),
    }));
    expect(problems(adrs, anyPath)).toEqual(["0002-b.md, 0002-c.md: share number 0002"]);
  });
});

describe("the ADR log in docs/adr", () => {
  const adrs = readdirSync(join(root, ADR_DIR))
    .filter((file) => /^\d{4}-.+\.md$/.test(file))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(root, ADR_DIR, file), "utf8") }));

  it("holds ADRs", () => {
    expect(adrs.length).toBeGreaterThan(0);
  });

  it("follows the ADR format", () => {
    expect(problems(adrs, (path) => existsSync(join(root, path)))).toEqual([]);
  });

  it("leaves no placeholder in any ADR", () => {
    expect(adrs.filter((adr) => adr.text.includes("{TBD}")).map((adr) => adr.file)).toEqual([]);
  });
});
