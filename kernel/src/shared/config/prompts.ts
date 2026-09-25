// Markdown prompt values (`kernel-settings`, Prompt values; design D-6): per
// prompt key, the files that form its value across the four layers. Each
// layer contributes one file, from `prompts.files.<key>` or from its prompts
// directory; `mode: replace` discards everything below it.
import { isAbsolute, join, posix } from "node:path";
import { parse } from "yaml";

import { splitFrontmatter } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { closest } from "./hint.ts";
import type { FileLayerName, Layer, LayerName } from "./layers.ts";
import type { ConfigProblem } from "./problems.ts";
import type { ConfigRegistry, PromptKey } from "./registry.ts";
import { isRecord } from "./values.ts";

export type PromptMode = "extends" | "replace";

export interface PromptFile {
  readonly layer: LayerName;
  readonly path: string;
  readonly applies?: readonly string[];
}

export interface PromptValue {
  readonly mode: PromptMode;
  readonly files: readonly PromptFile[];
}

export interface PromptInput {
  readonly store: Store;
  readonly registry: ConfigRegistry;
  /** The present file layers, lowest first. */
  readonly layers: readonly Layer[];
  readonly globalDir: string;
  readonly projectRoot: string;
  readonly pluginRoot: string;
}

export interface Prompts {
  /** Prompt key -> value, sorted by key. */
  readonly values: ReadonlyMap<string, PromptValue>;
  readonly problems: ConfigProblem[];
}

interface Contribution extends PromptFile {
  readonly mode: PromptMode;
}

const FILE_LAYERS: readonly FileLayerName[] = ["global", "project", "local"];
const DEFAULT_DIRS: Readonly<Record<FileLayerName, string>> = {
  global: "prompts",
  project: ".bdk/prompts",
  local: ".bdk/prompts.local",
};

export function resolvePrompts(input: PromptInput): Prompts {
  const problems: ConfigProblem[] = [];
  const byKey = new Map<string, Contribution[]>();
  const add = (key: string, contribution: Contribution): void => {
    byKey.set(key, [...(byKey.get(key) ?? []), contribution]);
  };

  for (const [key, path] of pluginDefaults(input))
    add(key, { layer: "default", path, mode: "extends" });
  for (const name of FILE_LAYERS) {
    const layer = input.layers.find((candidate) => candidate.name === name);
    for (const [key, contribution] of layerContributions(input, name, layer, problems)) {
      add(key, contribution);
    }
  }

  const values = new Map<string, PromptValue>();
  const keys = new Set([
    ...input.registry.prompts.filter((prompt) => !prompt.key.endsWith("/*")).map((p) => p.key),
    ...byKey.keys(),
  ]);
  for (const key of [...keys].sort()) values.set(key, chain(byKey.get(key) ?? []));
  return { values, problems };
}

/** The value's text: the bodies of its files, frontmatter removed, one blank line apart. */
export function promptContent(store: Store, value: PromptValue): string {
  return value.files
    .map((file) => splitFrontmatter(store.read(file.path) ?? "").body.trim())
    .filter((body) => body !== "")
    .map((body) => `${body}\n`)
    .join("\n");
}

function chain(contributions: readonly Contribution[]): PromptValue {
  const last = contributions.findLastIndex((item) => item.mode === "replace");
  const kept = last === -1 ? contributions : contributions.slice(last);
  return {
    mode: last === -1 ? "extends" : "replace",
    files: kept.map(({ layer, path, applies }) =>
      applies === undefined ? { layer, path } : { layer, path, applies },
    ),
  };
}

function pluginDefaults(input: PromptInput): [string, string][] {
  const found: [string, string][] = [];
  for (const prompt of input.registry.prompts) {
    if (prompt.defaultFile === undefined) continue;
    if (!prompt.key.endsWith("/*")) {
      const path = join(input.pluginRoot, prompt.defaultFile);
      if (input.store.exists(path)) found.push([prompt.key, path]);
      continue;
    }
    const [before = "", after = ""] = prompt.defaultFile.split("{name}");
    const dir = join(input.pluginRoot, posix.dirname(before + "x"));
    for (const entry of input.store.list(dir)) {
      if (entry.endsWith("/") || !entry.endsWith(after)) continue;
      const name = entry.slice(0, entry.length - after.length);
      found.push([`${prompt.key.slice(0, -1)}${name}`, join(dir, entry)]);
    }
  }
  return found;
}

function layerContributions(
  input: PromptInput,
  name: FileLayerName,
  layer: Layer | undefined,
  problems: ConfigProblem[],
): Map<string, Contribution> {
  const base = name === "global" ? input.globalDir : input.projectRoot;
  const settings = isRecord(layer?.values.prompts) ? layer.values.prompts : {};
  const dirSetting = typeof settings.dir === "string" ? settings.dir : DEFAULT_DIRS[name];
  const dir = isAbsolute(dirSetting) ? dirSetting : join(base, dirSetting);
  const where = { layer: name, settingsPath: layer?.path };
  const out = new Map<string, Contribution>();

  for (const [key, path] of listPrompts(input.store, dir)) {
    const prompt = input.registry.promptKey(key);
    if (prompt === undefined) {
      problems.push(unknownPrompt(input.registry, key, name, path));
      continue;
    }
    const contribution = readContribution(input.store, key, path, {}, where, problems);
    if (contribution !== undefined) out.set(key, contribution);
  }

  const files = isRecord(settings.files) ? settings.files : {};
  for (const [key, entry] of Object.entries(files)) {
    if (input.registry.promptKey(key) === undefined) continue; // named by the key walk
    const declared = isRecord(entry) ? entry : { path: entry };
    if (typeof declared.path !== "string") continue; // named by the schema
    const path = isAbsolute(declared.path) ? declared.path : join(base, declared.path);
    if (!input.store.exists(path)) {
      problems.push({
        rule: "policy/config-invalid",
        key: `prompts.files.${key}`,
        layer: name,
        ...(layer === undefined ? {} : { path: layer.path }),
        message: `${path} does not exist`,
      });
      continue;
    }
    const contribution = readContribution(input.store, key, path, declared, where, problems);
    if (contribution !== undefined) out.set(key, contribution);
  }
  return out;
}

/** Every `.md` file below `dir`, as prompt key -> path. */
function listPrompts(store: Store, dir: string, prefix = ""): [string, string][] {
  return store.list(dir).flatMap((entry): [string, string][] => {
    if (entry.endsWith("/")) {
      return listPrompts(store, join(dir, entry), `${prefix}${entry}`);
    }
    if (!entry.endsWith(".md")) return [];
    return [[`${prefix}${entry.slice(0, -3)}`, join(dir, entry)]];
  });
}

function unknownPrompt(
  registry: ConfigRegistry,
  key: string,
  layer: FileLayerName,
  path: string,
): ConfigProblem {
  const literal = registry.prompts
    .map((prompt: PromptKey) => prompt.key)
    .filter((k) => !k.endsWith("/*"));
  const hint = closest(key, literal);
  return {
    rule: "policy/unknown-config-key",
    key: `prompts.${key}`,
    layer,
    path,
    message: `no prompt key ${key} is registered${hint === undefined ? "" : `; did you mean ${hint}?`}`,
  };
}

const FRONTMATTER_FIELDS = new Set(["mode", "applies"]);

function readContribution(
  store: Store,
  key: string,
  path: string,
  declared: Readonly<Record<string, unknown>>,
  where: { readonly layer: FileLayerName; readonly settingsPath: string | undefined },
  problems: ConfigProblem[],
): Contribution | undefined {
  const outcome = contribution(store.read(path) ?? "", declared, where);
  if (typeof outcome !== "string") return { layer: where.layer, path, ...outcome };
  problems.push({
    rule: "policy/config-invalid",
    key: `prompts.${key}`,
    layer: where.layer,
    path,
    message: outcome,
  });
  return undefined;
}

/** The mode and applies of one file, or why they are invalid. */
function contribution(
  text: string,
  declared: Readonly<Record<string, unknown>>,
  where: { readonly settingsPath: string | undefined },
): Pick<Contribution, "mode" | "applies"> | string {
  const { frontmatter } = splitFrontmatter(text);
  let front: unknown;
  try {
    front = frontmatter === undefined ? {} : ((parse(frontmatter) as unknown) ?? {});
  } catch {
    return "the frontmatter is not valid YAML";
  }
  if (!isRecord(front)) return "the frontmatter must be a mapping";
  const extra = Object.keys(front).filter((field) => !FRONTMATTER_FIELDS.has(field));
  if (extra.length > 0) return `unknown frontmatter field ${extra.join(", ")}`;

  const settings = where.settingsPath ?? "the settings";
  const mode = front.mode ?? declared.mode ?? "extends";
  if (mode !== "extends" && mode !== "replace") return "mode must be extends or replace";
  if (declared.mode !== undefined && front.mode !== undefined && declared.mode !== front.mode) {
    return `the frontmatter mode ${mode} contradicts the mode in ${settings}`;
  }
  const applies = front.applies ?? declared.applies;
  if (applies !== undefined && !isGlobList(applies)) {
    return "applies must be a list of relative globs without empty segments";
  }
  if (
    declared.applies !== undefined &&
    front.applies !== undefined &&
    JSON.stringify(declared.applies) !== JSON.stringify(front.applies)
  ) {
    return `the frontmatter applies contradicts ${settings}`;
  }
  return applies === undefined ? { mode } : { mode, applies };
}

function isGlobList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item !== "" &&
        !/^(\/|[A-Za-z]:[\\/])/.test(item) &&
        !item.split("/").includes(""),
    )
  );
}
