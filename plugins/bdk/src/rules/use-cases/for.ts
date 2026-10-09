// `bdk rules for`: the rules a role of a stage reads for a set of files (spec `bdk-cli/rules`),
// from the BDK pack and the `rules` entries of the resolved configuration, with its `languages`.

import { dirname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

import { loadConfig } from "../../config/index.ts";
import type { ConfigDeps, ConfigState } from "../../config/index.ts";
import { CliError, closest } from "../../shared/cli/index.ts";
import { adjustPack, isPackId, projectRule } from "../domain/entries.ts";
import type { RuleEntry } from "../domain/entries.ts";
import { parseRule, ruleBody } from "../domain/rule.ts";
import type { Rule, Stage } from "../domain/rule.ts";
import { select } from "../domain/select.ts";
import type { ForResult } from "../schema/for.ts";
import { hasDir, readRuleFiles, readRuleText } from "../store/rules.ts";

export interface RulesDeps extends ConfigDeps {
  /** The BDK rule pack: `rules/` of the installed plugin. */
  readonly pack: string;
}

export interface ForInput {
  readonly stage: Stage;
  readonly files: readonly string[];
}

type Ok = Extract<ConfigState, { status: "ok" }>;
type Layer = Exclude<Rule["origin"], "bdk">;

/** Where a file the caller named sits relative to the root, `/`-separated. */
function rootRelative(root: string, cwd: string, file: string): string {
  const absolute = isAbsolute(file) ? normalize(file) : resolve(cwd, file);
  return relative(root, absolute).split(sep).join("/");
}

/** A path for output: root-relative under the root, absolute elsewhere. */
function display(root: string, path: string): string {
  const inside = relative(root, path);
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return path;
  }
  return inside.split(sep).join("/");
}

function readPack(deps: RulesDeps): Rule[] {
  const seen = new Map<string, string>();
  const invalid = (file: string, problem: string): CliError =>
    new CliError("env/invalid-rule", `${file}: ${problem}`, "Reinstall the bdk plugin.");
  return readRuleFiles(deps.files, deps.pack).map(({ relPath, content }) => {
    const file = `rules/${relPath}`;
    if (content === undefined) throw invalid(file, "cannot be read");
    const rule = parseRule({ relPath, file, content });
    if (typeof rule === "string") throw invalid(file, rule);
    const other = seen.get(rule.id);
    if (other !== undefined) throw invalid(file, `id ${rule.id} is also ${other}`);
    seen.set(rule.id, file);
    return rule;
  });
}

/** The layer whose entry sets the rule's `text` or `file`. */
function layerOf(config: Ok, id: string): Layer {
  const origin = config.origins.get(`rules.${id}.text`) ?? config.origins.get(`rules.${id}.file`);
  if (origin === undefined || origin === "default") {
    throw new Error(`no layer sets rules.${id}.text or rules.${id}.file`);
  }
  return origin;
}

function layerPath(config: Ok, layer: Layer): string {
  const file = config.files.find((candidate) => candidate.layer === layer);
  if (file === undefined) throw new Error(`no ${layer} layer file`);
  return file.path;
}

/** An enabled project rule, its `file` read and its frontmatter skipped. */
function readProjectRule(deps: RulesDeps, config: Ok, id: string, entry: RuleEntry): Rule {
  const origin = layerOf(config, id);
  if (entry.file === undefined) {
    const file = display(config.root, layerPath(config, origin));
    return projectRule({ id, entry, origin, file, text: entry.text ?? "" });
  }
  const base = origin === "global" ? dirname(layerPath(config, origin)) : config.root;
  const path = resolve(base, entry.file);
  const file = display(config.root, path);
  const invalid = (problem: string): CliError =>
    new CliError(
      "env/invalid-rule",
      `rules.${id}.file: ${file} ${problem}`,
      `Fix the file, or the rules.${id} entry in the ${origin} settings.`,
    );
  const content = readRuleText(deps.files, path);
  if (content === undefined) throw invalid("cannot be read");
  const text = ruleBody(content);
  if (text === "") throw invalid("holds no rule text");
  return projectRule({ id, entry, origin, file, text });
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
  const entries = config.settings.rules;
  const pack = adjustPack(readPack(deps), entries, closest);
  const project = Object.entries(entries)
    .filter(([id, entry]) => !isPackId(id) && entry.enabled !== false)
    .map(([id, entry]) => readProjectRule(deps, config, id, entry));
  const files = [...new Set(input.files.map((file) => rootRelative(config.root, deps.cwd, file)))];
  const selected = select({
    rules: [...pack.rules, ...project],
    stage: input.stage,
    files,
    languages: config.settings.languages,
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
    rules: selected.map((rule) => ({
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
    warnings: [...outside, ...pack.warnings],
  };
}
