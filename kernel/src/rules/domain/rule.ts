// A rule as the rules slice works on it (`kernel-state`, Rule file
// frontmatter; `rule-pack`, Pack layout): the frontmatter, the text, and
// where the file lives. The pack table maps each bundle directory to its prefix.

export type RuleScope = "bundle" | "project";

export interface LoadedRule {
  readonly id: string;
  readonly prefix: string;
  readonly number: number;
  readonly scope: RuleScope;
  /** Display path: relative to the plugin root for the bundle, to the project root otherwise. */
  readonly file: string;
  /** The bundle directory below `rules/`, e.g. `code-quality` or `languages/react`. */
  readonly pack?: string;
  readonly kind: "house" | "knowledge";
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly applies?: readonly string[];
  readonly roles?: readonly string[];
  readonly origin: string;
  readonly evidence?: readonly string[];
  readonly since: string;
  readonly source?: string;
  readonly verified?: string;
  readonly removed?: string;
  readonly text: string;
}

type ProblemCode =
  "format" | "id-mismatch" | "bundle-prefix" | "pack-dir" | "duplicate-id" | "unknown-disabled-id";

export interface RuleProblem {
  readonly code: ProblemCode;
  /** Display path of the file, or `rules.disabled`. */
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

/** The bundle's pack directories and their prefixes (`rule-pack`, Pack layout). */
export const PACK_DIRS: Readonly<Record<string, string>> = {
  "code-quality": "CQ",
  architecture: "ARCH",
  "design-patterns": "DP",
  security: "SEC",
  "test-quality": "TQ",
  "engineering-judgment": "EJ",
  plan: "PL",
  "languages/javascript": "JS",
  "languages/typescript": "TS",
  "languages/react": "REACT",
};

export const BUNDLE_PREFIX = "BDK-";

/** `BDK-CQ-4` -> `BDK-CQ`, `API-2` -> `API`. */
export function prefixOf(id: string): string {
  return id.slice(0, id.lastIndexOf("-"));
}

export function numberOf(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

/** The prefix without `BDK-`: what the role sets and the pack table name. */
export function familyOf(rule: Pick<LoadedRule, "prefix" | "scope">): string {
  return rule.scope === "bundle" ? rule.prefix.slice(BUNDLE_PREFIX.length) : rule.prefix;
}
