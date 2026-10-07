// The check slice (`kernel-cli/check`; #166): `check run` runs the post-task
// checks of a task or a part under its ticket, records their evidence and
// prints the commit command. `dispatch build` shows the same composition.
import type { Registration } from "../shared/registry/index.ts";
import { checkRunCommand } from "./commands/check.ts";
import { executionChecksModule } from "./config.ts";
import type { CheckDeps } from "./use-cases/deps.ts";

export type { CheckDeps } from "./use-cases/deps.ts";
export { stepCommands } from "./domain/commands.ts";
export type { ToolLists } from "./domain/commands.ts";

export const checkConfig = { modules: [executionChecksModule] };

export function checkRegistrations(deps: CheckDeps): Registration[] {
  return [{ id: "check-run", handler: checkRunCommand(deps) }];
}
