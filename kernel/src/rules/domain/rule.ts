// A rule as the rules slice works on it (`kernel-state`, Rule file
// frontmatter; `rule-pack`, Pack layout): the frontmatter, the text, and
// where the file lives. The pack table maps each bundle directory to its prefix.
import type { RuleStage } from "../../shared/vocabulary/index.ts";

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
  /** The globs of the files the rule governs; `**` is every file. */
  readonly paths: readonly string[];
  readonly stages: readonly RuleStage[];
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
  /** The duplicated id of a `duplicate-id` problem. */
  readonly id?: string;
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

/** The glob of a rule that governs every file. */
export const EVERY_FILE = "**";

/** `BDK-CQ-4` -> `BDK-CQ`, `API-2` -> `API`. */
export function prefixOf(id: string): string {
  return id.slice(0, id.lastIndexOf("-"));
}

export function numberOf(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

const PROJECT_PREFIX = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*$/;

/** Why a project prefix is refused, or undefined when it is valid. */
export function prefixProblem(prefix: string): string | undefined {
  if (!PROJECT_PREFIX.test(prefix)) {
    return `${prefix} is no rule prefix: [A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*`;
  }
  if (prefix === "BDK" || prefix.startsWith(BUNDLE_PREFIX)) {
    return `${prefix}: BDK ids belong to the shipped pack; pick a project prefix`;
  }
  return undefined;
}

/** `- [<id>] <text>`, continuation lines indented, ` (paths: ...)` unless the rule governs every file. */
export function ruleLine(rule: Pick<LoadedRule, "id" | "text" | "paths">): string {
  const paths = rule.paths.includes(EVERY_FILE) ? "" : ` (paths: ${rule.paths.join(", ")})`;
  return `- [${rule.id}] ${rule.text.replace(/\n/g, "\n  ")}${paths}\n`;
}
