// The module registry of `kernel-settings`, Registry and consumers (design
// D-1): a slice declares the settings it reads as config modules in its own
// `config.ts`; the composition root assembles them into one registry.
import * as z from "zod";

import { keyPaths, keyTree } from "./keys.ts";
import type { KeyNode } from "./keys.ts";

export interface ConfigModule<S extends z.ZodType = z.ZodType> {
  /** The root key, e.g. `tools`. */
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
  const shape: Record<string, z.ZodType> = {};
  for (const module of parts.modules) {
    if (module.key in shape) throw new Error(`config module ${module.key} is declared twice`);
    shape[module.key] = module.schema.meta({ description: module.description });
  }
  const seen = new Set<string>();
  for (const prompt of parts.prompts) checkPromptKey(prompt.key, seen);

  const schema = z.strictObject(shape);
  const tree = keyTree(schema);
  const prompts = parts.prompts;
  return {
    modules: parts.modules,
    prompts,
    schema,
    tree,
    keys: keyPaths(tree),
    promptKey: (key) => prompts.find((prompt) => matches(prompt.key, key)),
  };
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
