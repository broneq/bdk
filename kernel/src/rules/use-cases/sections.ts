// The rule texts as resolved prompt values (`kernel-settings`, Prompt values):
// one section per rule set, then one per language in `languages` that has a
// value. `ctx skill` prints them for a skill's rule parts, `rules show
// --ticket` for a role, and `dispatch build` hashes them.
import { posix } from "node:path";
import type * as z from "zod";

import { promptContent } from "../../shared/config/index.ts";
import type { ConfigModule, LayerName, Resolved } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { languagesModule, rulePrompts } from "../config.ts";
import type { RuleCategory } from "../config.ts";
import { ROLE_RULES } from "./selection.ts";

export interface RuleTextInput {
  readonly store: Store;
  readonly pluginRoot: string;
}

export interface RuleSection {
  /** The prompt key, `rules/<category>` or `rules/languages/<name>`. */
  readonly key: string;
  /** The plugin file of the default relative to the plugin root; else the lowest file. */
  readonly file: string;
  /** The layers whose files form the value, lowest first. */
  readonly layers: readonly LayerName[];
  readonly text: string;
}

/** The rule set `rules/<category>`; a missing value is a broken plugin and throws. */
export function ruleSection(
  input: RuleTextInput,
  resolved: Resolved,
  category: RuleCategory,
): RuleSection {
  const section = sectionOf(input, resolved, `rules/${category}`);
  if (section === undefined) {
    throw new Error(`the prompt value rules/${category} has no file in any layer`);
  }
  return section;
}

/** The language rules of every name in `languages` that has a prompt value, in order. */
export function languageSections(input: RuleTextInput, resolved: Resolved): RuleSection[] {
  return read(languagesModule, resolved).flatMap((name) => {
    const section = sectionOf(input, resolved, `rules/languages/${name}`);
    return section === undefined ? [] : [section];
  });
}

/** What `rules show --ticket` prints for a role (T23-D27). */
export function roleSections(input: RuleTextInput, resolved: Resolved, role: Role): RuleSection[] {
  const rules = ROLE_RULES[role];
  return [
    ...rules.categories.map((category) => ruleSection(input, resolved, category)),
    ...(rules.languages ? languageSections(input, resolved) : []),
  ];
}

/** The resolved text of `rules/<category>`, or undefined when no layer holds it. */
export function ruleSet(store: Store, resolved: Resolved, category: string): string | undefined {
  const value = resolved.prompts.values.get(declared(`rules/${category}`));
  return value === undefined ? undefined : promptContent(store, value);
}

function sectionOf(input: RuleTextInput, resolved: Resolved, key: string): RuleSection | undefined {
  const value = resolved.prompts.values.get(declared(key));
  const lowest = value?.files[0];
  if (value === undefined || lowest === undefined) return undefined;
  return {
    key,
    file: lowest.layer === "default" ? posix.relative(input.pluginRoot, lowest.path) : lowest.path,
    layers: [...new Set(value.files.map((file) => file.layer))],
    text: promptContent(input.store, value),
  };
}

/** `key`, checked against the prompt keys `rules` declares. */
function declared(key: string): string {
  const found = rulePrompts.some((prompt) =>
    prompt.key.endsWith("/*") ? key.startsWith(prompt.key.slice(0, -1)) : prompt.key === key,
  );
  if (!found) throw new Error(`${key} is not a prompt key rules declares`);
  return key;
}

/** A module's value, typed by its schema; the resolution already validated it. */
function read<S extends z.ZodType>(module: ConfigModule<S>, resolved: Resolved): z.output<S> {
  return module.schema.parse(resolved.value[module.key]);
}
