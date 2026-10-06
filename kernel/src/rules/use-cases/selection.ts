// Rule selection (`kernel-cli/rules`, bdk rules show, Selection; Stage
// readers): which rules a stage reads for a set of files, in the order a
// package records them. `dispatch build`, `rules explain`, `ctx` and the
// node instruction share it, so they never disagree. A rule's `stages` and
// `paths` are the whole answer: no table keyed by prefix or category.
import { matchesGlob } from "../../shared/store/index.ts";
import type { RuleStage } from "../../shared/vocabulary/index.ts";
import { EVERY_FILE } from "../domain/rule.ts";
import type { LoadedRule } from "../domain/rule.ts";

export interface SelectionInput {
  readonly rules: readonly LoadedRule[];
  /** The reader's stage; undefined for a reader without one, which selects nothing. */
  readonly stage: RuleStage | undefined;
  /** The target's files, or the work tree files for a target without its own. */
  readonly files: readonly string[];
  readonly languages: readonly string[];
  readonly disabled: readonly string[];
}

interface SelectedRule {
  readonly rule: LoadedRule;
  /** The most specific glob of the rule's `paths` that matched a file. */
  readonly matchedBy: string;
}

export interface Selection {
  /** Every applying rule, in package order: there is no cap (design D-5 of v3-t31). */
  readonly selected: readonly SelectedRule[];
  /** Ids of rules the stage would read here that `rules.disabled` switches off. */
  readonly disabled: readonly string[];
}

export function selectRules(input: SelectionInput): Selection {
  const { stage } = input;
  if (stage === undefined) return { selected: [], disabled: [] };
  const disabled = new Set(input.disabled);
  const applying: Ranked[] = [];
  const switchedOff: string[] = [];
  for (const rule of input.rules) {
    if (rule.removed !== undefined || !isCandidate(rule, input.languages)) continue;
    if (!rule.stages.includes(stage)) continue;
    const match = matchOf(rule, input.files);
    if (match === undefined) continue;
    if (disabled.has(rule.id)) {
      switchedOff.push(rule.id);
      continue;
    }
    applying.push({ rule, ...match });
  }
  applying.sort(compare);
  return {
    selected: applying.map(({ rule, matchedBy }) => ({ rule, matchedBy })),
    disabled: switchedOff,
  };
}

/** A language pack's rules are candidates only when the language is in `languages`. */
export function isCandidate(rule: LoadedRule, languages: readonly string[]): boolean {
  const language = rule.pack?.startsWith("languages/") ? rule.pack.slice(10) : undefined;
  return language === undefined || languages.includes(language);
}

interface Ranked extends SelectedRule {
  readonly segments: number;
  readonly literals: number;
}

type Match = Omit<Ranked, "rule">;

/** The most specific glob of the rule that matches a file, or undefined when none does. */
function matchOf(rule: LoadedRule, files: readonly string[]): Match | undefined {
  return rule.paths
    .filter((glob) => files.some((file) => matchesGlob(glob, file)))
    .map((glob) => ({ matchedBy: glob, ...specificity(glob) }))
    .sort((a, b) => b.segments - a.segments || b.literals - a.literals)[0];
}

/** The glob of the rule that matched the files, as the package's selection took it. */
export function matchedGlob(rule: LoadedRule, files: readonly string[]): string | null {
  return matchOf(rule, files)?.matchedBy ?? null;
}

/** Literal path segments, then literal characters: the more, the more specific. */
function specificity(glob: string): { segments: number; literals: number } {
  const wild = /[*?]/;
  return {
    segments: glob.split("/").filter((segment) => segment !== "" && !wild.test(segment)).length,
    literals: glob.replace(/[*?/]/g, "").length,
  };
}

/** Rules of every file first, then by specificity, `since`, prefix and number. */
function compare(a: Ranked, b: Ranked): number {
  const everyA = a.matchedBy === EVERY_FILE;
  if (everyA !== (b.matchedBy === EVERY_FILE)) return everyA ? -1 : 1;
  return (
    b.segments - a.segments ||
    b.literals - a.literals ||
    a.rule.since.localeCompare(b.rule.since) ||
    a.rule.prefix.localeCompare(b.rule.prefix) ||
    a.rule.number - b.rule.number
  );
}
