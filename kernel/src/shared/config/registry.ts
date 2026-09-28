// The module registry of `kernel-settings`, Registry and consumers (design
// D-1): a slice declares the settings it reads as config modules in its own
// `config.ts`; the composition root assembles them into one registry.
import * as z from "zod";

import { appendOnlyPaths, keyPaths, keyTree } from "./keys.ts";
import type { KeyNode } from "./keys.ts";
import { within } from "./known.ts";
import { joinKey, valueAt } from "./values.ts";

export interface ConfigModule<S extends z.ZodType = z.ZodType> {
  /** A root key (`tools`) or a dotted subtree of a root (`policy.budgets`). */
  readonly key: string;
  /** The slice that reads the module, or `shared/config`. */
  readonly consumer: string;
  /** The task that registered it (`kernel-settings` tables). */
  readonly owner: string;
  readonly description: string;
  /** The subtree's schema; its defaults are the default layer. */
  readonly schema: S;
}

export interface PromptKey {
  /** A file path below a prompts directory without `.md`; may end in `/*`. */
  readonly key: string;
  readonly consumer: string;
  readonly owner: string;
  /** Plugin-relative default file; `{name}` stands for the `*` of a pattern key. */
  readonly defaultFile?: string;
}

export interface ConfigRegistry {
  readonly modules: readonly ConfigModule[];
  readonly prompts: readonly PromptKey[];
  /** The strict schema of a whole settings file. */
  readonly schema: z.ZodType<Record<string, unknown>>;
  readonly tree: KeyNode;
  /** Every declared key path, parents first. */
  readonly keys: readonly string[];
  /** The dotted keys of the append-only arrays, for the merge. */
  readonly appendOnly: ReadonlySet<string>;
  promptKey(key: string): PromptKey | undefined;
}

export function defineConfigModule<S extends z.ZodType>(module: ConfigModule<S>): ConfigModule<S> {
  return module;
}

export function definePromptKey(prompt: PromptKey): PromptKey {
  return prompt;
}

const PROMPT_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const RESERVED = new Set(["dir", "files"]);

export function createConfigRegistry(parts: {
  readonly modules: readonly ConfigModule[];
  readonly prompts: readonly PromptKey[];
}): ConfigRegistry {
  checkModuleKeys(parts.modules);
  const seen = new Set<string>();
  for (const prompt of parts.prompts) checkPromptKey(prompt.key, seen);

  const schema = z.strictObject(composedShape(parts.modules, ""));
  const tree = keyTree(schema);
  const prompts = parts.prompts;
  return {
    modules: parts.modules,
    prompts,
    schema,
    tree,
    keys: keyPaths(tree),
    appendOnly: new Set(appendOnlyPaths(tree)),
    promptKey: (key) => prompts.find((prompt) => matches(prompt.key, key)),
  };
}

/** A module's resolved value, typed by its schema; the resolution already validated it. */
export function moduleValue<S extends z.ZodType>(
  module: ConfigModule<S>,
  resolved: Readonly<Record<string, unknown>>,
): z.output<S> {
  const steps = module.key.split(".").map((segment) => ({ segment, id: false }));
  return module.schema.parse(valueAt(resolved, steps));
}

/** Two modules never share a key, and no module's key lies below another's. */
function checkModuleKeys(modules: readonly ConfigModule[]): void {
  const keys: string[] = [];
  for (const { key } of modules) {
    if (keys.includes(key)) throw new Error(`config module ${key} is declared twice`);
    const overlap = keys.find((other) => within(key, other) || within(other, key));
    if (overlap !== undefined) throw new Error(`config module ${overlap} overlaps ${key}`);
    keys.push(key);
  }
}

/**
 * The strict shape below `prefix`: a module whose key is a child of it keeps
 * its schema; the modules sharing a deeper subtree compose one strict object.
 */
function composedShape(
  modules: readonly ConfigModule[],
  prefix: string,
): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  const below = modules.filter((module) => prefix === "" || within(module.key, prefix));
  for (const module of below) {
    const rest = prefix === "" ? module.key : module.key.slice(prefix.length + 1);
    const [segment = ""] = rest.split(".");
    if (segment in shape) continue;
    const child = joinKey(prefix, segment);
    const own = below.find((candidate) => candidate.key === child);
    if (own !== undefined) {
      shape[segment] = own.schema.meta({ description: own.description });
      continue;
    }
    const inner = below.filter((candidate) => within(candidate.key, child));
    shape[segment] = z
      .strictObject(composedShape(inner, child))
      .prefault({})
      .meta({ description: `Composed of ${inner.map((candidate) => candidate.key).join(", ")}.` });
  }
  return shape;
}

function checkPromptKey(key: string, seen: Set<string>): void {
  const segments = key.split("/");
  const last = segments.at(-1);
  const literal = last === "*" ? segments.slice(0, -1) : segments;
  const valid =
    literal.length > 0 &&
    literal.every((segment) => PROMPT_SEGMENT.test(segment)) &&
    !RESERVED.has(segments[0] ?? "");
  if (!valid) throw new Error(`prompt key ${key} is not a valid prompt key`);
  if (seen.has(key)) throw new Error(`prompt key ${key} is declared twice`);
  seen.add(key);
}

function matches(pattern: string, key: string): boolean {
  if (!pattern.endsWith("/*")) return pattern === key;
  const base = pattern.slice(0, -1);
  const rest = key.slice(base.length);
  return key.startsWith(base) && PROMPT_SEGMENT.test(rest);
}
