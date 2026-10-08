// The source model of the site's Reference (v3-268-docs-site-user-docs, design D3): what each
// plugin ships, read from the files Claude Code loads, the bdk command declarations and the
// settings schema. Every fact on a Reference page comes from here; nothing is typed twice.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";

import { describeSettings } from "../../plugins/bdk/src/config/domain/describe.ts";
import { isRuleFile, parseRule } from "../../plugins/bdk/src/rules/domain/rule.ts";
import type { Rule } from "../../plugins/bdk/src/rules/domain/rule.ts";
import type { SettingDoc } from "../../plugins/bdk/src/config/domain/describe.ts";
import { SettingsSchema } from "../../plugins/bdk/src/config/domain/settings.ts";
import type { Group } from "../../plugins/bdk/src/shared/cli/index.ts";
import { SLICES } from "../../plugins/bdk/src/slices.ts";

export interface SkillDoc {
  readonly name: string;
  readonly description: string;
  readonly argumentHint?: string;
  /** Who starts it: you or Claude, only other skills, or only you. */
  readonly invocation: "user-and-model" | "internal" | "user-only";
}

export interface AgentDoc {
  readonly name: string;
  readonly description: string;
  readonly model?: string;
  readonly tools?: readonly string[];
}

export interface HookDoc {
  readonly event: string;
  readonly matcher?: string;
  readonly command: string;
  readonly timeout?: number;
  readonly description: string;
}

export interface PluginDoc {
  readonly name: string;
  readonly description: string;
  readonly skills: readonly SkillDoc[];
  readonly agents: readonly AgentDoc[];
  readonly hooks: readonly HookDoc[];
}

export interface Model {
  readonly plugins: readonly PluginDoc[];
  /** The rule pack of the bdk plugin, in pack order (`bdk rules for` orders the same way). */
  readonly rules: readonly Rule[];
  /** The bdk command groups, sorted by name as `bdk --help` lists them. */
  readonly cli: readonly Group[];
  readonly settings: readonly SettingDoc[];
}

const REPO = join(import.meta.dirname, "../..");

function fail(path: string, problem: string): never {
  throw new Error(`${relative(REPO, path) || path}: ${problem}`);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function frontmatter(path: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"));
  if (match === null) fail(path, "has no frontmatter");
  const data: unknown = parse(match[1] ?? "");
  if (data === null || typeof data !== "object") fail(path, "frontmatter is not a mapping");
  return data as Record<string, unknown>;
}

function required(data: Record<string, unknown>, field: string, path: string): string {
  return text(data[field]) ?? fail(path, `frontmatter has no ${field}`);
}

function entries(dir: string, keep: (name: string) => boolean): string[] {
  return existsSync(dir) ? readdirSync(dir).filter(keep).sort() : [];
}

function readSkills(plugin: string): SkillDoc[] {
  const dir = join(plugin, "skills");
  return entries(dir, (name) => existsSync(join(dir, name, "SKILL.md"))).map((name) => {
    const path = join(dir, name, "SKILL.md");
    const data = frontmatter(path);
    const hint = text(data["argument-hint"]);
    return {
      name: required(data, "name", path),
      description: required(data, "description", path),
      ...(hint === undefined ? {} : { argumentHint: hint }),
      invocation:
        data["user-invocable"] === false
          ? "internal"
          : data["disable-model-invocation"] === true
            ? "user-only"
            : "user-and-model",
    };
  });
}

function readAgents(plugin: string): AgentDoc[] {
  const dir = join(plugin, "agents");
  return entries(dir, (name) => name.endsWith(".md")).map((file) => {
    const path = join(dir, file);
    const data = frontmatter(path);
    const model = text(data.model);
    const tools = text(data.tools);
    return {
      name: required(data, "name", path),
      description: required(data, "description", path),
      ...(model === undefined ? {} : { model }),
      ...(tools === undefined ? {} : { tools: tools.split(",").map((tool) => tool.trim()) }),
    };
  });
}

/** The first sentence of a script's leading doc comment (`/** ... *\/`). */
function docComment(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const match = /^(?:#![^\n]*\n)?\s*\/\*\*([\s\S]*?)\*\//.exec(readFileSync(path, "utf8"));
  if (match === null) return undefined;
  const body = (match[1] ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .trim();
  return /^.*?\.(?=\s|$)/.exec(body)?.[0] ?? text(body);
}

function hookDescription(
  plugin: string,
  command: string,
  cli: readonly Group[],
): string | undefined {
  const verb = /\/dist\/bdk\.mjs"? hooks ([a-z-]+)/.exec(command)?.[1];
  if (verb !== undefined) {
    const summary = cli
      .find((group) => group.name === "hooks")
      ?.commands.find((candidate) => candidate.verb === verb)?.summary;
    return summary === undefined ? undefined : `${summary}.`;
  }
  const script = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"']+\.m?js)/.exec(command)?.[1];
  return script === undefined ? undefined : docComment(join(plugin, script));
}

interface HookFile {
  hooks?: Record<
    string,
    { matcher?: string; hooks?: { type?: string; command?: string; timeout?: number }[] }[]
  >;
}

function readHooks(plugin: string, cli: readonly Group[]): HookDoc[] {
  const path = join(plugin, "hooks", "hooks.json");
  if (!existsSync(path)) return [];
  const file = JSON.parse(readFileSync(path, "utf8")) as HookFile;
  return Object.entries(file.hooks ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([event, groups]) =>
      groups.flatMap((group) =>
        (group.hooks ?? []).map((hook) => {
          const command = hook.command ?? fail(path, `a ${event} hook has no command`);
          const description =
            hookDescription(plugin, command, cli) ??
            fail(
              path,
              `the ${event} hook "${command}" has no description: run a bdk hooks command or a script with a leading /** */ comment`,
            );
          return {
            event,
            ...(group.matcher === undefined ? {} : { matcher: group.matcher }),
            command,
            ...(hook.timeout === undefined ? {} : { timeout: hook.timeout }),
            description,
          };
        }),
      ),
    );
}

/** Every plugin under `pluginsDir` (a directory with `.claude-plugin/plugin.json`), by name. */
export function readPlugins(pluginsDir: string, cli: readonly Group[]): PluginDoc[] {
  return entries(pluginsDir, (name) =>
    existsSync(join(pluginsDir, name, ".claude-plugin", "plugin.json")),
  ).map((dir) => {
    const plugin = join(pluginsDir, dir);
    const path = join(plugin, ".claude-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    return {
      name: required(manifest, "name", path),
      description: required(manifest, "description", path),
      skills: readSkills(plugin),
      agents: readAgents(plugin),
      hooks: readHooks(plugin, cli),
    };
  });
}

/** Anything a group factory receives; using it while building a declaration is an error. */
const NO_DEPS: unknown = new Proxy(
  {},
  {
    get: (_target, key) =>
      typeof key === "symbol"
        ? undefined
        : () => {
            throw new Error(`a bdk group factory used its dependency ${key} while building`);
          },
  },
);

/** The bdk command groups, built from each slice's `<slice>Group` factory, sorted by name. */
export async function bdkGroups(): Promise<Group[]> {
  const groups = await Promise.all(
    Object.keys(SLICES).map(async (slice) => {
      const module = (await import(`../../plugins/bdk/src/${slice}/index.ts`)) as Record<
        string,
        unknown
      >;
      const factory = module[`${slice}Group`];
      if (typeof factory !== "function") {
        throw new Error(`plugins/bdk/src/${slice}/index.ts exports no ${slice}Group`);
      }
      return (factory as (deps: unknown) => Group)(NO_DEPS);
    }),
  );
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function ruleFiles(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const relPath = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return ruleFiles(dir, `${relPath}/`);
      return isRuleFile(relPath) ? [relPath] : [];
    });
}

/** Number-aware order of rule ids: `BDK-REACT-2` before `BDK-REACT-10`. */
function byId(a: Rule, b: Rule): number {
  return a.id.localeCompare(b.id, "en", { numeric: true });
}

/** Every rule of a rule pack directory, parsed as `bdk rules for` parses it. */
export function readRules(dir: string): Rule[] {
  return ruleFiles(dir)
    .map((relPath) => {
      const file = join(dir, relPath);
      const rule = parseRule({
        relPath,
        file: relative(REPO, file),
        origin: "bdk",
        content: readFileSync(file, "utf8"),
      });
      return typeof rule === "string" ? fail(file, rule) : rule;
    })
    .sort(byId);
}

/** The whole model, read from this repository. */
export async function loadModel(): Promise<Model> {
  const cli = await bdkGroups();
  return {
    plugins: readPlugins(join(REPO, "plugins"), cli),
    rules: readRules(join(REPO, "plugins/bdk/rules")),
    cli,
    settings: describeSettings(SettingsSchema),
  };
}
