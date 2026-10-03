// Rule selection (`kernel-cli/rules`, bdk rules show, Selection; design D-5
// of v3-t31): which rules a role reads for a set of files, in the order a
// package records them. `dispatch build`, `rules explain` and `ctx` share it,
// so the three never disagree.
import { matchesGlob } from "../../shared/store/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { familyOf } from "../domain/rule.ts";
import type { LoadedRule } from "../domain/rule.ts";

const LANGUAGES = ["JS", "TS", "REACT"] as const;
const WRITERS = ["CQ", "ARCH", "DP", "SEC", "TQ", ...LANGUAGES] as const;

/** The pack prefixes each role reads, held in the kernel (T23-D27). */
const ROLE_PREFIXES: Readonly<Record<Role, readonly string[]>> = {
  implementer: WRITERS,
  simplifier: WRITERS,
  reviewer: WRITERS,
  "integration-reviewer": ["ARCH", "SEC", "TQ"],
  "pr-reviewer": WRITERS,
  verifier: ["ARCH", "TQ", "EJ", "PL"],
  "design-verifier": ["ARCH", "EJ", "SEC"],
  runner: [],
  scout: [],
  lead: [],
};

export interface SelectionInput {
  readonly rules: readonly LoadedRule[];
  readonly role: Role;
  /** The target's files; undefined for an artifact or the Change, where every rule applies. */
  readonly files: readonly string[] | undefined;
  readonly languages: readonly string[];
  readonly disabled: readonly string[];
}

interface SelectedRule {
  readonly rule: LoadedRule;
  /** The glob that matched, null for a global rule or without a file set. */
  readonly matchedBy: string | null;
}

export interface Selection {
  /** Every applying rule, in package order: there is no cap (design D-5). */
  readonly selected: readonly SelectedRule[];
  /** Ids of rules the role would read here that `rules.disabled` switches off. */
  readonly disabled: readonly string[];
}

export function selectRules(input: SelectionInput): Selection {
  const disabled = new Set(input.disabled);
  const applying: Ranked[] = [];
  const switchedOff: string[] = [];
  for (const rule of input.rules) {
    if (rule.removed !== undefined || !isCandidate(rule, input.languages)) continue;
    if (!readBy(rule, input.role)) continue;
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
function isCandidate(rule: LoadedRule, languages: readonly string[]): boolean {
  const language = rule.pack?.startsWith("languages/") ? rule.pack.slice(10) : undefined;
  return language === undefined || languages.includes(language);
}

function readBy(rule: LoadedRule, role: Role): boolean {
  if (rule.roles !== undefined) return rule.roles.includes(role);
  const prefixes = ROLE_PREFIXES[role];
  if (rule.scope === "project") return prefixes.length > 0;
  return prefixes.includes(familyOf(rule));
}

interface Ranked extends SelectedRule {
  readonly global: boolean;
  readonly segments: number;
  readonly literals: number;
}

type Match = Omit<Ranked, "rule">;

/** How the rule applies to the files, or undefined when it does not. */
function matchOf(rule: LoadedRule, files: readonly string[] | undefined): Match | undefined {
  const globs = rule.applies;
  if (globs === undefined || globs.length === 0) {
    return { matchedBy: null, global: true, segments: 0, literals: 0 };
  }
  const candidates =
    files === undefined
      ? globs
      : globs.filter((glob) => files.some((file) => matchesGlob(glob, file)));
  const best = candidates
    .map((glob) => ({ glob, ...specificity(glob) }))
    .sort((a, b) => b.segments - a.segments || b.literals - a.literals)[0];
  if (best === undefined) return undefined;
  return {
    matchedBy: files === undefined ? null : best.glob,
    global: false,
    segments: best.segments,
    literals: best.literals,
  };
}

/** The glob of the rule that matched the files, as the package's selection took it. */
export function matchedGlob(rule: LoadedRule, files: readonly string[] | undefined): string | null {
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

function compare(a: Ranked, b: Ranked): number {
  if (a.global !== b.global) return a.global ? -1 : 1;
  return (
    b.segments - a.segments ||
    b.literals - a.literals ||
    a.rule.since.localeCompare(b.rule.since) ||
    a.rule.prefix.localeCompare(b.rule.prefix) ||
    a.rule.number - b.rule.number
  );
}
