// Which rules a role reads (spec `bdk-cli/rules`, "Rules for a stage and files"): pure, so the
// same rules and inputs give the same answer. Rules switched off never reach it (`entries.ts`).

import { minimatch } from "minimatch";

import type { Rule, Stage } from "./rule.ts";

export interface SelectInput {
  readonly rules: readonly Rule[];
  readonly stage: Stage;
  /** Root-relative paths; none drops the path condition. */
  readonly files: readonly string[];
  readonly languages: readonly string[];
}

export interface Selected extends Rule {
  /** The given files the rule's paths match, in the given order; empty without files. */
  readonly matched: readonly string[];
}

const ORIGIN_ORDER = { bdk: 0, global: 1, project: 2, local: 3 } as const;

/** Origin first, then id with numbers compared by value (`BDK-REACT-2` before `BDK-REACT-10`). */
function order(a: Rule, b: Rule): number {
  return (
    ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin] ||
    a.id.localeCompare(b.id, "en", { numeric: true })
  );
}

export function select(input: SelectInput): Selected[] {
  const selected: Selected[] = [];
  for (const rule of input.rules) {
    if (rule.language !== null && !input.languages.includes(rule.language)) continue;
    if (!rule.stages.includes(input.stage)) continue;
    const matched = input.files.filter((file) =>
      rule.paths.some((glob) => minimatch(file, glob, { dot: true })),
    );
    if (input.files.length > 0 && matched.length === 0) continue;
    selected.push({ ...rule, matched });
  }
  return selected.sort(order);
}
