// The rules slice (`kernel-cli/rules`): the rule store over the bundle's pack
// and `.bdk/rules/`, the selection `dispatch build` stamps, the rule lists
// `ctx` prints, and the `languages` and `rules` settings it owns (T23-D30).
import type { Registration } from "../shared/registry/index.ts";
import {
  acceptCommand,
  checkCommand,
  explainCommand,
  exportCommand,
  importCommand,
  pruneCommand,
  statsCommand,
} from "./commands/rules.ts";
import { showCommand } from "./commands/show.ts";
import { languagesModule, rulesModule } from "./config.ts";
import type { RulesDeps } from "./use-cases/deps.ts";

export {
  languageRules,
  packRules,
  projectRules,
  RULE_CATEGORIES,
  ruleContext,
  ruleLines,
  selectFor,
} from "./use-cases/context.ts";
export type { RulesInput } from "./use-cases/context.ts";
export { PROJECT_RULES_DIR } from "./use-cases/store.ts";
export type { RulesDeps } from "./use-cases/deps.ts";

export const rulesConfig = {
  modules: [languagesModule, rulesModule],
  prompts: [],
};

export function rulesRegistrations(deps: RulesDeps): Registration[] {
  return [
    { id: "rules-check", handler: checkCommand(deps) },
    { id: "rules-show", handler: showCommand(deps), resolvesChange: "handler" },
    { id: "rules-explain", handler: explainCommand(deps) },
    { id: "rules-prune", handler: pruneCommand(deps) },
    { id: "rules-import", handler: importCommand(deps) },
    { id: "rules-export", handler: exportCommand(deps) },
    { id: "rules-stats", handler: statsCommand(deps) },
    { id: "rules-accept", handler: acceptCommand(deps) },
  ];
}
