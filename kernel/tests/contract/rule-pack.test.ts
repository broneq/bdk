// `rule-pack`, Migration report (T31): every bullet T40 measured has exactly
// one row in `docs/V3-RULES-MIGRATION.md`, and that row carries a decision.
// The measured ids come from the committed M1 rows, which hold one question
// per bullet.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

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
