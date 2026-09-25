import { existsSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Config, ResolvedTarget, Rule, RuleSetting, Severity } from "./index.ts";
import { genericRules } from "./rules/index.ts";

/** A usage or configuration error: exit 2, reason on stderr. */
export class ConfigError extends Error {
  override name = "ConfigError";
}

export interface Setting {
  severity: Severity | "off";
  options: Record<string, unknown>;
}

export type Settings = Record<string, RuleSetting>;

export interface LoadedTarget extends ResolvedTarget {
  settings: Settings;
}

export interface LoadedConfig {
  /** Absolute directory of the config file; every config path is relative to it. */
  root: string;
  file: string;
  targets: LoadedTarget[];
  rules: Map<string, Rule<object>>;
  settings: Settings;
  /** Absolute baseline path, when the config names one. */
  baseline: string | undefined;
}

const CONFIG_NAMES = ["skill-check.config.ts", "skill-check.config.mjs", "skill-check.config.js"];

export async function loadConfig(cwd: string, explicit?: string): Promise<LoadedConfig> {
  const file = explicit
    ? resolve(cwd, explicit)
    : CONFIG_NAMES.map((n) => resolve(cwd, n)).find(existsSync);
  if (!file) throw new ConfigError(`no skill-check.config.ts, .mjs or .js in ${cwd}`);
  if (!existsSync(file)) throw new ConfigError(`config file ${file} does not exist`);

  let config: unknown;
  try {
    config = ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
  } catch (error) {
    throw new ConfigError(`cannot load ${basename(file)}: ${(error as Error).message}`);
  }
  if (!isConfig(config)) {
    throw new ConfigError("the config must export a default object with a `targets` array");
  }

  const root = dirname(file);
  const rules = registry(config);
  const settings = config.rules ?? {};
  checkSettings(settings, rules, "rules");

  const targets = config.targets.map((target, index) =>
    loadTarget(target, index, root, rules, settings),
  );

  return {
    root,
    file,
    targets,
    rules,
    settings,
    baseline: config.baseline === undefined ? undefined : resolve(root, config.baseline),
  };
}

/** A target as written in the config file: its values are not trusted yet. */
type RawTarget = Partial<Record<"kind" | "dirs" | "profile" | "name" | "rules", unknown>>;

export function loadTarget(
  value: unknown,
  index: number,
  root: string,
  rules: Map<string, Rule<object>>,
  settings: Settings,
): LoadedTarget {
  const target = (typeof value === "object" && value !== null ? value : {}) as RawTarget;
  const dirs = Array.isArray(target.dirs) ? (target.dirs as unknown[]) : [];
  const name =
    typeof target.name === "string"
      ? target.name
      : typeof dirs[0] === "string"
        ? dirs[0]
        : `#${index + 1}`;
  const fail = (message: string) => new ConfigError(`target \`${name}\`: ${message}`);

  const kind = target.kind;
  if (kind !== "skills" && kind !== "agents") throw fail("kind must be skills or agents");
  const profile = target.profile ?? "claude-code";
  if (profile !== "claude-code" && profile !== "portable") {
    throw fail("profile must be claude-code or portable");
  }
  if (profile === "portable" && kind === "agents") {
    throw fail(
      "the portable profile has no agents (the Agent Skills standard defines only skills)",
    );
  }
  if (dirs.length === 0 || !dirs.every((d) => typeof d === "string")) {
    throw fail("dirs must list at least one directory");
  }
  for (const dir of dirs) {
    const full = resolve(root, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) {
      throw fail(`directory \`${dir}\` does not exist`);
    }
  }
  const own = (target.rules ?? {}) as Settings;
  checkSettings(own, rules, `target \`${name}\``);
  return { kind, dirs, profile, name, settings: { ...settings, ...own } };
}

function isConfig(value: unknown): value is Config {
  return typeof value === "object" && value !== null && Array.isArray((value as Config).targets);
}

function registry(config: Config): Map<string, Rule<object>> {
  const rules = new Map<string, Rule<object>>();
  const add = (id: string, rule: Rule<object>) => {
    if (rules.has(id)) throw new ConfigError(`duplicate rule ID \`${id}\``);
    rules.set(id, { ...rule, id });
  };
  for (const rule of genericRules) add(rule.id, rule);
  for (const plugin of config.plugins ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name)) {
      throw new ConfigError(`plugin name \`${plugin.name}\` must be lowercase kebab-case`);
    }
    for (const rule of plugin.rules) add(`${plugin.name}/${rule.id}`, rule);
  }
  return rules;
}

function checkSettings(settings: Settings, rules: Map<string, Rule<object>>, where: string): void {
  for (const [id, setting] of Object.entries(settings)) {
    if (!rules.has(id)) throw new ConfigError(`unknown rule \`${id}\` in ${where}`);
    parseSetting(id, setting);
  }
}

function parseSetting(id: string, setting: unknown): Setting {
  if (setting === "off" || setting === "warning" || setting === "error") {
    return { severity: setting, options: {} };
  }
  if (Array.isArray(setting)) {
    const [severity, options] = setting as unknown[];
    if (
      (severity === "warning" || severity === "error") &&
      typeof options === "object" &&
      options !== null
    ) {
      return { severity, options: options as Record<string, unknown> };
    }
  }
  throw new ConfigError(
    `rule \`${id}\`: setting must be off, warning, error or [severity, options]`,
  );
}

/** The effective severity and options of one rule under a settings map. */
export function settingOf(rule: Rule<object>, settings: Settings): Setting {
  const own = settings[rule.id];
  const parsed =
    own === undefined
      ? { severity: rule.defaultSeverity, options: {} }
      : parseSetting(rule.id, own);
  return {
    severity: parsed.severity,
    options: { ...(rule.defaultOptions ?? {}), ...parsed.options },
  };
}
