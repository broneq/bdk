// The rules of a project as the other slices read them (`kernel-cli/rules`;
// `kernel-cli/ctx`, bdk ctx skill): the loaded pack and project rules with
// the settings that select among them, and the one selection every reader
// uses: `dispatch build`, `ctx skill` and the node instruction.
import type { Resolved } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { RuleStage } from "../../shared/vocabulary/index.ts";
import { languagesModule, rulesModule } from "../config.ts";
import { ruleLine } from "../domain/rule.ts";
import { selectRules } from "./selection.ts";
import type { Selection } from "./selection.ts";
import { loadRules } from "./store.ts";
import type { RuleSet } from "./store.ts";

export interface RulesInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly projectRoot: string;
}

export interface RuleContext extends RuleSet {
  readonly languages: readonly string[];
  readonly disabled: readonly string[];
  /** `rules.warn-above`: the rules one role may read before `hooks session-start` warns. */
  readonly warnAbove: number;
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
    warnAbove: settings["warn-above"],
    minChanges: settings.audit["min-changes"],
    uncitedChanges: settings.prune["uncited-changes"],
  };
}

/** The rules a stage reads for the target's files, or for the work tree files of a target without its own. */
export function selectFor(
  context: RuleContext,
  stage: RuleStage | undefined,
  files: readonly string[],
): Selection {
  return selectRules({
    rules: context.rules,
    stage,
    files,
    languages: context.languages,
    disabled: context.disabled,
  });
}

/**
 * A stage's selection over `files` as `ctx skill` and a node instruction print
 * it: `- [<id>] <text>` per rule, ` (paths: ...)` after a scoped one.
 */
export function stageRuleLines(
  context: RuleContext,
  stage: RuleStage,
  files: readonly string[],
): string {
  return selectFor(context, stage, files)
    .selected.map(({ rule }) => ruleLine(rule))
    .join("");
}
