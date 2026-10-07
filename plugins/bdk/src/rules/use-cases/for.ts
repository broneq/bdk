// `bdk rules for`: the rules a role of a stage reads for a set of files (spec `bdk-cli/rules`),
// from the BDK pack and the project's `.bdk/rules/`, with `languages` and `rules.disabled` of the
// resolved configuration.

import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

import { loadConfig } from "../../config/index.ts";
import type { ConfigDeps } from "../../config/index.ts";
import { CliError, closest } from "../../shared/cli/index.ts";
import { parseRule } from "../domain/rule.ts";
import type { Rule, Stage } from "../domain/rule.ts";
import { select } from "../domain/select.ts";
import type { ForResult } from "../schema/for.ts";
import { hasDir, readRuleFiles } from "../store/rules.ts";

export interface RulesDeps extends ConfigDeps {
  /** The BDK rule pack: `rules/` of the installed plugin. */
  readonly pack: string;
}

export interface ForInput {
  readonly stage: Stage;
  readonly files: readonly string[];
}

/** Where a file the caller named sits relative to the root, `/`-separated. */
function rootRelative(root: string, cwd: string, file: string): string {
  const absolute = isAbsolute(file) ? normalize(file) : resolve(cwd, file);
  return relative(root, absolute).split(sep).join("/");
}

function invalid(file: string, problem: string, origin: Rule["origin"]): CliError {
  return new CliError(
    "env/invalid-rule",
    `${file}: ${problem}`,
    origin === "bdk" ? "Reinstall the bdk plugin." : "Fix the rule file or delete it.",
  );
}

function readRules(deps: RulesDeps, dir: string, display: string, origin: Rule["origin"]): Rule[] {
  const seen = new Map<string, string>();
  return readRuleFiles(deps.files, dir).map(({ relPath, content }) => {
    const file = `${display}/${relPath}`;
    if (content === undefined) throw invalid(file, "cannot be read", origin);
    const rule = parseRule({ relPath, file, origin, content });
    if (typeof rule === "string") throw invalid(file, rule, origin);
    const other = seen.get(rule.id);
    if (other !== undefined) throw invalid(file, `id ${rule.id} is also ${other}`, origin);
    seen.set(rule.id, file);
    return rule;
  });
}

export function rulesFor(deps: RulesDeps, input: ForInput): ForResult {
  const config = loadConfig(deps);
  if (config.status === "not-configured") {
    throw new CliError(
      "env/not-configured",
      `BDK not configured in ${config.root}: missing ${config.missing.join(", ")}`,
      "Run /bdk:setup.",
    );
  }
  if (config.status === "invalid") {
    throw new CliError(
      "env/config-invalid",
      `the BDK configuration has ${String(config.problems.length)} problem(s)`,
      "Run bdk config check.",
    );
  }
  if (!hasDir(deps.files, deps.pack)) {
    throw new CliError(
      "env/no-rule-pack",
      `the BDK rule pack ${deps.pack} is missing`,
      "Reinstall the bdk plugin.",
    );
  }
  const rules = [
    ...readRules(deps, deps.pack, "rules", "bdk"),
    ...readRules(deps, join(config.root, ".bdk", "rules"), ".bdk/rules", "project"),
  ];
  const files = [...new Set(input.files.map((file) => rootRelative(config.root, deps.cwd, file)))];
  const selection = select({
    rules,
    stage: input.stage,
    files,
    languages: config.settings.languages,
    disabled: config.settings.rules.disabled,
    closest,
  });
  const outside = files
    .filter((file) => file === "" || file === ".." || file.startsWith("../"))
    .map(
      (file) =>
        `${file === "" ? "." : file} is not a file under the project root; no rule path matches it`,
    );
  return {
    stage: input.stage,
    files,
    // `measured` stays out: admission is the pack tests' concern, not the role's (design D3).
    rules: selection.rules.map((rule) => ({
      id: rule.id,
      origin: rule.origin,
      kind: rule.kind,
      language: rule.language,
      file: rule.file,
      paths: [...rule.paths],
      stages: [...rule.stages],
      source: rule.source,
      verified: rule.verified,
      matched: [...rule.matched],
      text: rule.text,
    })),
    warnings: [...outside, ...selection.warnings],
  };
}
