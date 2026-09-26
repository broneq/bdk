// The rule tester, published as `bdk-skill-kit/testing`: runs one rule over an
// in-test file tree through the same discovery, parsing, option merging and
// runner as the CLI. A separate bundle, so the main entry never loads it.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { ConfigError, loadTarget, type Settings, validateOptions } from "./config.ts";
import type { Finding, Profile, Rule, TargetKind } from "./index.ts";
import { runChecks } from "./runner.ts";

export interface RuleTest<O extends object = Record<string, unknown>> {
  /** File contents by path, POSIX, relative to the one target directory. */
  files: Record<string, string>;
  /** Defaults to `skills`. */
  kind?: TargetKind;
  /** Defaults to `claude-code`. */
  profile?: Profile;
  /** Merged over the rule's default options, as a config setting is. */
  options?: Partial<O>;
}

/**
 * Runs one rule, `check` and `checkProject`, over `files` and resolves to its
 * findings in report order, with paths relative to the target directory. A
 * rule that is off by default runs at `error`. The files live in a temporary
 * directory that is removed before the promise settles.
 */
export async function checkRule<O extends object>(
  rule: Rule<O>,
  test: RuleTest<O>,
): Promise<Finding[]> {
  for (const path of Object.keys(test.files)) {
    if (isAbsolute(path) || normalize(path).split(sep)[0] === "..") {
      throw new ConfigError(`file path \`${path}\` must stay inside the target directory`);
    }
  }
  const severity = rule.defaultSeverity === "off" ? "error" : rule.defaultSeverity;
  const settings: Settings = {
    [rule.id]: test.options === undefined ? severity : [severity, test.options],
  };
  const rules = new Map<string, Rule<object>>([[rule.id, rule]]);
  const kind = test.kind ?? "skills";
  const root = await mkdtemp(join(tmpdir(), "skill-check-rule-"));
  try {
    for (const [path, content] of Object.entries(test.files)) {
      const full = join(root, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content);
    }
    const target = { kind, dirs: ["."], profile: test.profile, name: kind };
    const targets = [loadTarget(target, 0, root, rules, settings)];
    validateOptions(rules, settings, targets);
    return runChecks({ root, targets, rules, settings }, { cwd: root, paths: [] }).findings;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
