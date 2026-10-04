// The attempt slice (`kernel-cli/attempt`, `kernel-loops`): tickets, budgets,
// oscillation and the escalation ladder over the committed attempt records.
import type { Registration } from "../shared/registry/index.ts";
import { closeCommand, listCommand, openCommand, showCommand } from "./commands/attempt.ts";
import { budgetsModule, escalationModule, oscillationModule } from "./config.ts";
import type { AttemptDeps } from "./use-cases/deps.ts";

export const attemptConfig = {
  modules: [budgetsModule, oscillationModule, escalationModule],
  prompts: [],
};

export function attemptRegistrations(deps: AttemptDeps): Registration[] {
  return [
    { id: "attempt-open", handler: openCommand(deps) },
    { id: "attempt-close", handler: closeCommand(deps) },
    { id: "attempt-list", handler: listCommand(deps) },
    { id: "attempt-show", handler: showCommand(deps) },
  ];
}
