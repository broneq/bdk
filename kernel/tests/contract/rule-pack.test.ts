// `rule-pack` (T31): the shipped pack's layout and admission, and the
// migration report every bullet T40 measured has a row in. The measured ids
// come from the committed M1 rows, which hold one question per bullet.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { PACK_DIRS } from "../../src/rules/domain/rule.ts";
import { splitFrontmatter } from "../../src/shared/store/index.ts";
import { LANGUAGE_PATHS, PACK_STAGES } from "../support/pack-layout.ts";
import { REPO_ROOT, runBdk } from "../support/run.ts";

const RESULTS = join(REPO_ROOT, "evals/results/rules-noop");
const REPORT = join(REPO_ROOT, "docs/V3-RULES-MIGRATION.md");
const DECISION = /^(?:kept as BDK-[A-Z]+-[1-9][0-9]*|removed: \S.*)$/;

function measuredIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of readdirSync(RESULTS).filter((name) => /^series-m1-.*\.jsonl$/.test(name))) {
    for (const line of readFileSync(join(RESULTS, file), "utf8").split("\n")) {
      if (line.trim() !== "") ids.add((JSON.parse(line) as { item: string }).item);
    }
  }
  return ids;
}

interface Row {
  readonly id: string;
  readonly decision: string;
}

/** The table rows whose first cell is a backticked T40 id; the decision is the column so named. */
function reportRows(text: string): Row[] {
  const lines = text.split("\n");
  const rows: Row[] = [];
  let decisionColumn = -1;
  for (const line of lines) {
    if (!line.startsWith("|")) {
      decisionColumn = -1;
      continue;
    }
    const cells = line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    if (decisionColumn === -1) {
      decisionColumn = cells.indexOf("decision");
      continue;
    }
    const id = /^`([^`]+)`$/.exec(cells[0] ?? "")?.[1];
    if (id !== undefined) rows.push({ id, decision: cells[decisionColumn] ?? "" });
  }
  return rows;
}

describe("docs/V3-RULES-MIGRATION.md", () => {
  it("every measured bullet has exactly one row with a decision", () => {
    const measured = measuredIds();
    expect(measured.size).toBe(131);
    const rows = reportRows(readFileSync(REPORT, "utf8"));
    for (const id of measured) {
      const own = rows.filter((row) => row.id === id);
      expect(own, id).toHaveLength(1);
      expect(own[0]?.decision, id).toMatch(DECISION);
    }
    expect(rows.filter((row) => !measured.has(row.id)).map((row) => row.id)).toStrictEqual([]);
  });
});

interface PackRule {
  /** Relative to `rules/`, without the file name. */
  readonly dir: string;
  readonly name: string;
  readonly data: Record<string, unknown>;
}

const PACK = join(REPO_ROOT, "rules");

function packRules(dir = PACK): PackRule[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry): PackRule[] => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return packRules(path);
    if (dir === PACK && entry.name === "README.md") return [];
    const { frontmatter } = splitFrontmatter(readFileSync(path, "utf8"));
    const data = (frontmatter === undefined ? {} : parse(frontmatter)) as Record<string, unknown>;
    return [{ dir: relative(PACK, dir).split("\\").join("/"), name: entry.name, data }];
  });
}

/** The ids the migration report keeps; a later measurement report adds its own. */
const MEASURED_REPORTS = ["docs/V3-RULES-MIGRATION.md"];

function keptIds(): Set<string> {
  const kept = new Set<string>();
  for (const report of MEASURED_REPORTS) {
    for (const row of reportRows(readFileSync(join(REPO_ROOT, report), "utf8"))) {
      const id = /^kept as (\S+)$/.exec(row.decision)?.[1];
      if (id !== undefined) kept.add(id);
    }
  }
  return kept;
}

describe("the shipped pack", () => {
  const rules = packRules();

  it("every file sits in a pack directory, named by its BDK id, with origin bdk", () => {
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const where = `rules/${rule.dir}/${rule.name}`;
      const prefix = PACK_DIRS[rule.dir];
      expect(prefix, `${where} is in no pack directory`).toBeDefined();
      expect(rule.data.id, where).toMatch(new RegExp(`^BDK-${prefix ?? ""}-[1-9][0-9]*$`));
      expect(rule.name, where).toBe(`${String(rule.data.id)}.md`);
      expect(rule.data.origin, where).toBe("bdk");
    }
  });

  it("every rule states the stages of its directory and paths for its files", () => {
    for (const rule of rules) {
      const where = `rules/${rule.dir}/${rule.name}`;
      expect(rule.data.stages, where).toStrictEqual(PACK_STAGES[rule.dir]);
      if (rule.data.id === "BDK-CQ-9") continue;
      expect(rule.data.paths, where).toStrictEqual(LANGUAGE_PATHS[rule.dir] ?? ["**"]);
    }
  });

  it("every knowledge rule carries source and verified", () => {
    for (const rule of rules.filter((found) => found.data.kind === "knowledge")) {
      expect(rule.data, rule.name).toHaveProperty("source");
      expect(rule.data, rule.name).toHaveProperty("verified");
    }
  });

  it("holds the plan rules BDK-PL-1 to BDK-PL-4 as house rules", () => {
    const plan = rules.filter((rule) => rule.dir === "plan");
    expect(plan.map((rule) => rule.data.id).sort()).toStrictEqual([
      "BDK-PL-1",
      "BDK-PL-2",
      "BDK-PL-3",
      "BDK-PL-4",
    ]);
    for (const rule of plan) expect(rule.data.kind, rule.name).toBe("house");
  });

  it("admits BDK-CQ-9 without measurement, scoped to the lockfiles", () => {
    const lockfiles = rules.find((rule) => rule.data.id === "BDK-CQ-9");
    expect(lockfiles?.dir).toBe("code-quality");
    expect(lockfiles?.data.kind).toBe("house");
    expect(lockfiles?.data.paths).toStrictEqual(
      expect.arrayContaining([
        "**/pnpm-lock.yaml",
        "**/package-lock.json",
        "**/yarn.lock",
        "**/Cargo.lock",
        "**/poetry.lock",
        "**/uv.lock",
        "**/go.sum",
        "**/Gemfile.lock",
        "**/composer.lock",
      ]),
    );
    expect(keptIds().has("BDK-CQ-9")).toBe(false);
  });

  it("every language rule has a measurement row", () => {
    const kept = keptIds();
    const unmeasured = rules
      .filter((rule) => rule.dir.startsWith("languages/"))
      .filter((rule) => !kept.has(String(rule.data.id)))
      .map((rule) => `rules/${rule.dir}/`);
    expect([...new Set(unmeasured)], "measure the pack before it ships").toStrictEqual([]);
  });

  it("every kept bullet exists in the pack and is no tombstone", () => {
    const byId = new Map(rules.map((rule) => [String(rule.data.id), rule]));
    for (const id of keptIds()) {
      expect(byId.get(id)?.data, id).toBeDefined();
      expect(byId.get(id)?.data.removed, id).toBeUndefined();
    }
  });

  it("validates with bdk rules check", () => {
    const result = runBdk(["rules", "check", "--json"], REPO_ROOT);
    expect(result.code, result.stdout).toBe(0);
  });

  it("keeps no v2 rule file next to the pack directories", () => {
    for (const dir of ["", "languages"]) {
      const files = readdirSync(join(PACK, dir)).filter(
        (name) => name.endsWith(".md") && !(dir === "" && name === "README.md"),
      );
      expect(files, `rules/${dir}`).toStrictEqual([]);
    }
    expect(existsSync(join(PACK, "README.md"))).toBe(true);
  });
});

describe("the definition of a rule", () => {
  it.each(["rules/README.md", "docs/guide/concepts/quality-and-language-rules.md"])(
    "%s states it, names both kinds and the two non-rules",
    (path) => {
      const text = readFileSync(join(REPO_ROOT, path), "utf8").replace(/\s+/g, " ");
      expect(text).toContain("a choice among valid alternatives");
      expect(text).toMatch(/`house`/);
      expect(text).toMatch(/`knowledge`/);
      expect(text).toContain("a fact about the project's own system");
      expect(text).toContain("a process lesson");
    },
  );
});
