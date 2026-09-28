// The rules slice (`kernel-cli/rules`): the rule texts and `languages` it owns
// (T23-D30), and the rules of a ticket's role. `ctx` and `dispatch` read the
// texts from here.
import type { Registration } from "../shared/registry/index.ts";
import { showCommand } from "./commands/show.ts";
import { languagesModule, rulePrompts } from "./config.ts";
import type { RulesDeps } from "./use-cases/deps.ts";

export type { RuleCategory } from "./config.ts";
export { languageSections, roleSections, ruleSection, ruleSet } from "./use-cases/sections.ts";
export type { RulesDeps } from "./use-cases/deps.ts";

export const rulesConfig = {
  modules: [languagesModule],
  prompts: rulePrompts,
};

export function rulesRegistrations(deps: RulesDeps): Registration[] {
  return [{ id: "rules-show", handler: showCommand(deps) }];
}
