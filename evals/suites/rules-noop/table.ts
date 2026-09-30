// The rules no-op tables (design D-8): per rule bullet, the majority knowledge
// outcome of each model (M1), the detection rates of a review with and without
// the rules (M2) under the difference rule, and the provisional class handed
// to T31; above the table, the A/A noise floor of both measurements.
import type { ResultRow } from "../../harness/results.ts";
import { compare, median, range } from "../../harness/stats.ts";
import type { Comparison } from "../../harness/stats.ts";
import type { Bullet } from "./bullets.ts";
import { violationKey } from "./patches.ts";
import type { Violations } from "./patches.ts";

/** The M1 cells: two models answer blind, the Sonnet cell twice for the A/A pair. */
export const M1_CELLS = ["haiku", "sonnet", "sonnet-prime"] as const;
/** The M2 cells: a review with the rules, the same again for the A/A pair, and one without. */
export const M2_CELLS = ["with", "with-prime", "without"] as const;

export type Outcome = "COVERED" | "MISSED" | "WRONG";
/** An M1 row's `knowledge` metric. */
export const OUTCOME_VALUE: Readonly<Record<Outcome, number>> = {
  COVERED: 1,
  MISSED: 0,
  WRONG: -1,
};
export type Majority = Outcome | "MIXED" | "n/a";

/** An M2 row's metric: the number of distinct problems the review reports. */
export const CLAIMED = "claimed";

/** At or above this without-rules detection rate, a rule the models already follow is a no-op candidate. */
const NO_OP_RATE = 0.8;

type ProvisionalClass = "effective" | "corrects the model" | "no-op candidate" | "unclear";

interface Detection {
  /** Per run, the fraction of the bullet's seeded violations the review found. */
  readonly with: readonly number[];
  readonly without: readonly number[];
  /** Null with fewer than 2 counted runs in a cell. */
  readonly comparison: Comparison | null;
}

export interface BulletRow {
  readonly id: string;
  readonly file: string;
  readonly text: string;
  readonly haiku: Majority;
  readonly sonnet: Majority;
  /** Null for a bullet without a seeded violation ("not seedable"). */
  readonly detection: Detection | null;
  readonly provisionalClass: ProvisionalClass;
}

/** The outcome of more than half of the counted runs; MIXED when none has it. */
export function majority(values: readonly number[]): Majority {
  if (values.length === 0) return "n/a";
  for (const [outcome, value] of Object.entries(OUTCOME_VALUE)) {
    if (values.filter((entry) => entry === value).length * 2 > values.length) {
      return outcome as Outcome;
    }
  }
  return "MIXED";
}

function counted(rows: readonly ResultRow[]): ResultRow[] {
  return rows.filter((row) => row.discarded === null);
}

function knowledgeOf(rows: readonly ResultRow[], cell: string, bullet: string): number[] {
  return rows
    .filter((row) => row.cell === cell && row.item === bullet)
    .map((row) => row.metrics.knowledge ?? null)
    .filter((value): value is number => value !== null);
}

/** Per run of a cell, the mean of the metric values the keys select across the patches' rows. */
function perRun(
  rows: readonly ResultRow[],
  cell: string,
  keysOf: (patch: string) => readonly string[],
): number[] {
  const runs = new Map<number, number[]>();
  for (const row of rows) {
    if (row.cell !== cell) continue;
    for (const key of keysOf(row.item)) {
      const value = row.metrics[key];
      if (value === undefined || value === null) continue;
      runs.set(row.run, [...(runs.get(row.run) ?? []), value]);
    }
  }
  return [...runs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, values]) => values.reduce((sum, value) => sum + value, 0) / values.length);
}

function comparison(a: readonly number[], b: readonly number[]): Comparison | null {
  return a.length < 2 || b.length < 2 ? null : compare(a, b);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classify(
  haiku: Majority,
  sonnet: Majority,
  detection: Detection | null,
): ProvisionalClass {
  if (detection?.comparison?.verdict === "a") return "effective";
  if (haiku === "WRONG" || sonnet === "WRONG") return "corrects the model";
  if (haiku === "COVERED" && sonnet === "COVERED") {
    if (detection === null) return "no-op candidate";
    if (
      detection.comparison?.verdict === "no-difference" &&
      mean(detection.without) >= NO_OP_RATE
    ) {
      return "no-op candidate";
    }
  }
  return "unclear";
}

/** The seeded violation keys of each bullet, per patch. */
function keysByBullet(violations: Violations): Map<string, Map<string, string[]>> {
  const keys = new Map<string, Map<string, string[]>>();
  for (const { patch, violations: seeded } of violations.patches) {
    for (const violation of seeded) {
      const patches = keys.get(violation.bullet) ?? new Map<string, string[]>();
      patches.set(patch, [...(patches.get(patch) ?? []), violationKey(violation)]);
      keys.set(violation.bullet, patches);
    }
  }
  return keys;
}

export function bulletRows(
  allRows: readonly ResultRow[],
  bullets: readonly Bullet[],
  violations: Violations,
): BulletRow[] {
  const rows = counted(allRows);
  const keys = keysByBullet(violations);
  return bullets.map((bullet) => {
    const haiku = majority(knowledgeOf(rows, "haiku", bullet.id));
    const sonnet = majority(knowledgeOf(rows, "sonnet", bullet.id));
    const patches = keys.get(bullet.id);
    let detection: Detection | null = null;
    if (patches !== undefined) {
      const keysOf = (patch: string): readonly string[] => patches.get(patch) ?? [];
      const withRules = perRun(rows, "with", keysOf);
      const without = perRun(rows, "without", keysOf);
      detection = { with: withRules, without, comparison: comparison(withRules, without) };
    }
    return {
      id: bullet.id,
      file: bullet.file,
      text: bullet.text,
      haiku,
      sonnet,
      detection,
      provisionalClass: classify(haiku, sonnet, detection),
    };
  });
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function summary(values: readonly number[]): string {
  if (values.length === 0) return "n/a";
  const low = Math.min(...values);
  return `${number(median(values))} [${number(low)}..${number(low + range(values))}]`;
}

function verdictText(result: Comparison | null, a: string, b: string): string {
  if (result === null) return "fewer than 2 counted runs";
  const detail = `gap ${number(result.gap)}, noise ${number(result.noise)}`;
  if (result.verdict === "no-difference") return `no difference (${detail})`;
  return `${result.verdict === "a" ? a : b} higher (${detail})`;
}

function cellText(text: string): string {
  return text.replace(/\s+/g, " ").replaceAll("|", "\\|");
}

export function rulesReport(
  allRows: readonly ResultRow[],
  bullets: readonly Bullet[],
  violations: Violations,
): string[] {
  const rows = counted(allRows);
  const table = bulletRows(allRows, bullets, violations);
  const allKeys = violations.patches.flatMap(({ patch, violations: seeded }) =>
    seeded.map((violation) => [patch, violationKey(violation)] as const),
  );
  const seededKeys = (patch: string): string[] =>
    allKeys.filter(([name]) => name === patch).map(([, key]) => key);
  const detectionOf = (cell: string): number[] => perRun(rows, cell, seededKeys);
  const clean = new Set(
    violations.patches.filter((entry) => entry.violations.length === 0).map((entry) => entry.patch),
  );
  const claimed = (cell: string): number[] =>
    rows
      .filter((row) => row.cell === cell && clean.has(row.item))
      .map((row) => row.metrics[CLAIMED] ?? null)
      .filter((value): value is number => value !== null);

  const paired = bullets.filter(
    (bullet) =>
      knowledgeOf(rows, "sonnet", bullet.id).length > 0 &&
      knowledgeOf(rows, "sonnet-prime", bullet.id).length > 0,
  );
  const differing = paired.filter(
    (bullet) =>
      majority(knowledgeOf(rows, "sonnet", bullet.id)) !==
      majority(knowledgeOf(rows, "sonnet-prime", bullet.id)),
  );
  const series = [...new Set(allRows.map((row) => row.series))];
  const discarded = allRows.filter((row) => row.discarded !== null);
  const classes = new Map<ProvisionalClass, number>();
  for (const entry of table) {
    classes.set(entry.provisionalClass, (classes.get(entry.provisionalClass) ?? 0) + 1);
  }

  const lines = [
    "# rules no-op results",
    "",
    `Series: ${series.length === 0 ? "none" : series.join(", ")}. Counted runs: ${String(rows.length)}. Discarded: ${String(discarded.length)}.`,
    "",
    "## Noise floor",
    "",
    `- M1 A/A (sonnet vs sonnet-prime): ${String(differing.length)} of ${String(paired.length)} bullets differ in majority outcome.`,
    `- M2 A/A (with vs with-prime), detection per run: ${verdictText(comparison(detectionOf("with"), detectionOf("with-prime")), "with", "with-prime")}.`,
    `- M2 with vs without, detection per run over all seeded violations: ${verdictText(comparison(detectionOf("with"), detectionOf("without")), "with", "without")}.`,
    `- clean controls, claimed findings per review: ${M2_CELLS.map((cell) => `${cell} ${summary(claimed(cell))}`).join(", ")}.`,
    "",
    "## Per bullet",
    "",
    `Provisional classes: ${[...classes.entries()].map(([name, count]) => `${name} ${String(count)}`).join(", ")}.`,
    "",
    "| id | file | text | haiku | sonnet | with | without | with vs without | class |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...table.map((entry) => {
      const detection =
        entry.detection === null
          ? ["not seedable", "not seedable", "-"]
          : [
              summary(entry.detection.with),
              summary(entry.detection.without),
              verdictText(entry.detection.comparison, "with", "without"),
            ];
      return `| ${[entry.id, entry.file, cellText(entry.text), entry.haiku, entry.sonnet, ...detection, entry.provisionalClass].join(" | ")} |`;
    }),
  ];
  if (discarded.length > 0) {
    lines.push(
      "",
      "## Discarded runs",
      "",
      ...discarded.map(
        (row) =>
          `- ${row.series} ${row.cell} ${row.item} run ${String(row.run)}: ${row.discarded ?? ""}`,
      ),
    );
  }
  return lines;
}
