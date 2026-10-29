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
const STATUSES = "proposed, accepted, rejected, deprecated, superseded by ADR-NNNN";

interface Adr {
  file: string;
  text: string;
}

const NAME = /^(\d{4})-.+\.md$/;
const STATUS = /^(proposed|accepted|rejected|deprecated|superseded by ADR-\d{4})$/;
// A paid eval case: a directory under plugins/<name>/evals/ that is not its fixtures or results.
const EVAL_CASE = /^plugins\/[^/]+\/evals\/(?!fixtures$|results$)[^/]+$/;

function problems(adrs: Adr[], exists: (path: string) => boolean): string[] {
  const badNames = adrs
    .filter(({ file }) => !NAME.test(file))
    .map(({ file }) => `${file}: name must match NNNN-<title>.md`);
  const named = adrs.filter(({ file }) => NAME.test(file));
  return [
    ...badNames,
    ...named.flatMap((adr) => fieldProblems(adr, exists)),
    ...duplicateNumbers(named),
  ];
}

function duplicateNumbers(adrs: Adr[]): string[] {
  const byNumber = new Map<string, string[]>();
  for (const { file } of adrs) {
    const number = file.slice(0, 4);
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
  const status = fields?.status;
  const shown = typeof status === "string" ? status : JSON.stringify(status);
  const badStatus =
    status === undefined || (typeof status === "string" && STATUS.test(status))
      ? []
      : [`${adr.file}: status ${shown} is not one of ${STATUSES}`];
  const number = adr.file.slice(0, 4);
  const badTitle = new RegExp(`^# ADR-${number}\\b`, "m").test(adr.text)
    ? []
    : [`${adr.file}: H1 must start with # ADR-${number}`];
  return [
    ...missing,
    ...badStatus,
    ...badTitle,
    ...enforcerProblems(adr.file, fields?.["enforced-by"], exists),
    ...measureProblems(adr.file, fields?.["measured-by"], exists),
  ];
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
  return (enforcedBy as string[]).flatMap((path) => {
    if (EVAL_CASE.test(path)) {
      return [`${file}: enforced-by ${path} is an eval case; list it in measured-by`];
    }
    return exists(path) ? [] : [`${file}: enforced-by ${path} does not exist`];
  });
}

function measureProblems(
  file: string,
  measuredBy: unknown,
  exists: (path: string) => boolean,
): string[] {
  if (measuredBy === undefined) return [];
  const isPathList =
    Array.isArray(measuredBy) &&
    measuredBy.length > 0 &&
    measuredBy.every((entry) => typeof entry === "string");
  if (!isPathList) {
    return [`${file}: measured-by must be a non-empty list of eval case directories`];
  }
  return measuredBy.flatMap((path) => {
    if (!EVAL_CASE.test(path)) {
      return [
        `${file}: measured-by ${path} is not an eval case directory (plugins/<name>/evals/<case>)`,
      ];
    }
    return exists(path) ? [] : [`${file}: measured-by ${path} does not exist`];
  });
}

const valid = (enforcedBy: string) =>
  `---\nstatus: accepted\ndate: 2026-10-29\ndecision-makers: broneq\nenforced-by: ${enforcedBy}\n---\n\n# ADR-0001: A\n`;
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
    expect(problems([{ file: "0001-a.md", text: "# ADR-0001: A\n" }], anyPath)).toHaveLength(4);
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

  it("passes a measured-by list of eval case directories", () => {
    const text = valid("none").replace(
      "enforced-by: none\n",
      "enforced-by: none\nmeasured-by:\n  - plugins/bdk/evals/judge-levels\n",
    );
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([]);
  });

  it("fails a measured-by entry that does not exist", () => {
    const text = valid("none").replace(
      "enforced-by: none\n",
      "enforced-by: none\nmeasured-by:\n  - plugins/bdk/evals/gone\n",
    );
    expect(problems([{ file: "0001-a.md", text }], () => false)).toEqual([
      "0001-a.md: measured-by plugins/bdk/evals/gone does not exist",
    ]);
  });

  it.each([["tests/a.test.ts"], ["plugins/bdk/evals/fixtures"], ["plugins/bdk/evals/a/b"]])(
    "fails measured-by %s, which is not an eval case directory",
    (path) => {
      const text = valid("none").replace(
        "enforced-by: none\n",
        `enforced-by: none\nmeasured-by:\n  - ${path}\n`,
      );
      expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
        `0001-a.md: measured-by ${path} is not an eval case directory (plugins/<name>/evals/<case>)`,
      ]);
    },
  );

  it.each([["[]"], ["none"], ["yes"]])(
    "fails measured-by %s, which is not a list of paths",
    (value) => {
      const text = valid("none").replace(
        "enforced-by: none\n",
        `enforced-by: none\nmeasured-by: ${value}\n`,
      );
      expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
        "0001-a.md: measured-by must be a non-empty list of eval case directories",
      ]);
    },
  );

  it("fails an enforced-by entry that is an eval case directory", () => {
    const text = valid("\n  - tests/a.test.ts\n  - plugins/bdk/evals/judge-levels");
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
      "0001-a.md: enforced-by plugins/bdk/evals/judge-levels is an eval case; list it in measured-by",
    ]);
  });

  it.each(["proposed", "accepted", "rejected", "deprecated", "superseded by ADR-0002"])(
    "passes status %s",
    (status) => {
      const text = valid("none").replace("status: accepted", `status: ${status}`);
      expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([]);
    },
  );

  it.each(["done", "Accepted", "superseded"])("fails status %s", (status) => {
    const text = valid("none").replace("status: accepted", `status: ${status}`);
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
      `0001-a.md: status ${status} is not one of ${STATUSES}`,
    ]);
  });

  it("fails an H1 whose number differs from the file number", () => {
    const text = valid("none").replace("# ADR-0001:", "# ADR-0002:");
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
      "0001-a.md: H1 must start with # ADR-0001",
    ]);
  });

  it("fails an ADR without an H1", () => {
    const text = valid("none").replace(/^# .*\n/m, "");
    expect(problems([{ file: "0001-a.md", text }], anyPath)).toEqual([
      "0001-a.md: H1 must start with # ADR-0001",
    ]);
  });

  it.each(["template.md", "1-a.md", "0001.md", "00001-a.md"])(
    "fails %s, whose name is not NNNN-title.md",
    (file) => {
      expect(problems([{ file, text: valid("none") }], anyPath)).toEqual([
        `${file}: name must match NNNN-<title>.md`,
      ]);
    },
  );

  it("fails two ADRs that share a number", () => {
    const adrs = ["0001-a.md", "0002-b.md", "0002-c.md"].map((file) => ({
      file,
      text: valid("none").replace("ADR-0001", `ADR-${file.slice(0, 4)}`),
    }));
    expect(problems(adrs, anyPath)).toEqual(["0002-b.md, 0002-c.md: share number 0002"]);
  });
});

describe("the ADR log in docs/adr", () => {
  const adrs = readdirSync(join(root, ADR_DIR))
    .filter((file) => file.endsWith(".md"))
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
