// The doctor finding for a rule that ignores the files BDK commits: v2 wrote
// `/.bdk/` into `.gitignore`, which v3's tracked settings, rules and Changes
// then never leave (design D-9 of v3-t32-python-cut).

/** The path the check asks git about: tracked in v3, ignored by the v2 rule. */
export const TRACKED_PROBE = ".bdk/settings.yaml";

export interface IgnoreRule {
  /** The file holding the rule, as git names it (`.gitignore`, `.git/info/exclude`). */
  readonly source: string;
  readonly line: number;
  readonly pattern: string;
}

export interface IgnoredFinding {
  readonly id: "bdk-ignored";
  readonly level: "fail";
  readonly summary: string;
  readonly repair: "/bdk:setup";
}

/**
 * The rule in `git check-ignore --verbose` output (`<source>:<line>:<pattern>\t<path>`);
 * undefined when the matching rule is a negation, which un-ignores the path.
 */
export function parseIgnoreRule(stdout: string): IgnoreRule | undefined {
  const match = /^(.*):(\d+):(.*)\t/.exec(stdout);
  if (match === null) return undefined;
  const [, source = "", line = "", pattern = ""] = match;
  if (pattern.startsWith("!")) return undefined;
  return { source, line: Number(line), pattern };
}

export function ignoredFinding(rule: IgnoreRule): IgnoredFinding {
  return {
    id: "bdk-ignored",
    level: "fail",
    summary: `${rule.source} ignores ${TRACKED_PROBE} with ${rule.pattern} (line ${String(rule.line)}), so the files BDK commits never reach git`,
    repair: "/bdk:setup",
  };
}
