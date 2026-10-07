// Which rules a role reads (spec `bdk-cli/rules`, "Rules for a stage and files"; spec
// `rule-pack`, "Switching rules off"): pure, so the same rules and inputs give the same answer.

import { minimatch } from "minimatch";

import type { Rule, Stage } from "./rule.ts";

export interface SelectInput {
  readonly rules: readonly Rule[];
  readonly stage: Stage;
  /** Root-relative paths; none drops the path condition. */
  readonly files: readonly string[];
  readonly languages: readonly string[];
  readonly disabled: readonly string[];
  /** "Did you mean": the frame's `closest`, passed in since `domain/` imports no `shared/`. */
  readonly closest: (input: string, names: readonly string[]) => string | undefined;
}

export interface Selected extends Rule {
  /** The given files the rule's paths match, in the given order; empty without files. */
  readonly matched: readonly string[];
}

export interface Selection {
  readonly rules: readonly Selected[];
  readonly warnings: readonly string[];
}

const ORIGIN_ORDER = { bdk: 0, project: 1 } as const;

/** Origin first, then id with numbers compared by value (`BDK-REACT-2` before `BDK-REACT-10`). */
function order(a: Rule, b: Rule): number {
  return (
    ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin] ||
    a.id.localeCompare(b.id, "en", { numeric: true })
  );
}

export function select(input: SelectInput): Selection {
  const warnings: string[] = [];
  const ids = input.rules.map((rule) => rule.id);
  for (const id of input.disabled) {
    if (ids.includes(id)) continue;
    const near = input.closest(id, ids);
    warnings.push(
      `rules.disabled names no rule ${id}${near === undefined ? "" : `; did you mean ${near}?`}`,
    );
  }
  for (const language of input.languages) {
    if (!input.rules.some((rule) => rule.language === language)) {
      warnings.push(`no rules for language ${language}`);
    }
  }
  const selected: Selected[] = [];
  for (const rule of input.rules) {
    if (input.disabled.includes(rule.id)) continue;
    if (rule.language !== null && !input.languages.includes(rule.language)) continue;
    if (!rule.stages.includes(input.stage)) continue;
    const matched = input.files.filter((file) =>
      rule.paths.some((glob) => minimatch(file, glob, { dot: true })),
    );
    if (input.files.length > 0 && matched.length === 0) continue;
    selected.push({ ...rule, matched });
  }
  return { rules: selected.sort(order), warnings };
}
