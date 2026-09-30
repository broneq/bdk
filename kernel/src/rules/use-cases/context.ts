// The rules of a project as the other slices read them (`kernel-cli/rules`;
// `kernel-cli/ctx`, bdk ctx skill): the loaded pack and project rules with
// the settings that select among them, the per-category and per-language
// lists `ctx` prints, and the selection `dispatch build` stamps.
import type { Resolved } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { languagesModule, rulesModule } from "../config.ts";
import { PACK_DIRS } from "../domain/rule.ts";
import type { LoadedRule } from "../domain/rule.ts";
import { selectRules } from "./selection.ts";
import type { Selection } from "./selection.ts";
import { loadRules } from "./store.ts";
import type { RuleSet } from "./store.ts";

/** The pack's category directories: what a pipeline node's `rules` and a `rules` part name. */
export const RULE_CATEGORIES: readonly string[] = Object.keys(PACK_DIRS).filter(
  (dir) => !dir.startsWith("languages/"),
);

export interface RulesInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly projectRoot: string;
}

export interface RuleContext extends RuleSet {
  readonly languages: readonly string[];
  readonly disabled: readonly string[];
  readonly cap: number;
  readonly minChanges: number;
  readonly uncitedChanges: number;
}

export function ruleContext(input: RulesInput, resolved: Resolved): RuleContext {
  const languages = languagesModule.schema.parse(resolved.value[languagesModule.key]);
  const settings = rulesModule.schema.parse(resolved.value[rulesModule.key]);
  const set = loadRules({ ...input, disabled: settings.disabled });
  return {
    ...set,
    languages,
    disabled: settings.disabled,
    cap: settings["max-per-package"],
    minChanges: settings.audit["min-changes"],
    uncitedChanges: settings.prune["uncited-changes"],
  };
}

/** The rules a role reads for the target's files (undefined: no file set). */
export function selectFor(
  context: RuleContext,
  role: Role,
  files: readonly string[] | undefined,
): Selection {
  return selectRules({
    rules: context.rules,
    role,
    files,
    languages: context.languages,
    disabled: context.disabled,
    cap: context.cap,
  });
}

/** The enabled rules of one pack directory, in id order. */
export function packRules(context: RuleContext, pack: string): LoadedRule[] {
  return enabled(context).filter((rule) => rule.scope === "bundle" && rule.pack === pack);
}

/** The enabled rules of `.bdk/rules/`, in id order. */
export function projectRules(context: RuleContext): LoadedRule[] {
  return enabled(context).filter((rule) => rule.scope === "project");
}

/** Each language of `languages` with a pack, with its enabled rules. */
export function languageRules(
  context: RuleContext,
): { readonly language: string; readonly rules: LoadedRule[] }[] {
  return context.languages
    .map((language) => ({ language, rules: packRules(context, `languages/${language}`) }))
    .filter((entry) => entry.rules.length > 0);
}

/** `- [<id>] <text>` per rule, ` (applies: ...)` after a scoped one. */
export function ruleLines(rules: readonly LoadedRule[]): string {
  return rules
    .map((rule) => {
      const applies =
        rule.applies === undefined || rule.applies.length === 0
          ? ""
          : ` (applies: ${rule.applies.join(", ")})`;
      return `- [${rule.id}] ${rule.text.replace(/\n/g, "\n  ")}${applies}\n`;
    })
    .join("");
}

function enabled(context: RuleContext): LoadedRule[] {
  const disabled = new Set(context.disabled);
  return context.rules
    .filter((rule) => rule.removed === undefined && !disabled.has(rule.id))
    .sort((a, b) => a.prefix.localeCompare(b.prefix) || a.number - b.number);
}
