// The agents slice (`kernel-cli/agents`, `kernel-state` Agent registry): the
// registry of running subagents the agent hooks write and `bdk agents` reads.
// A leaf: `hooks` imports it for the lifecycle writes and the guards.
import type { Registration } from "../shared/registry/index.ts";
import { listCommand, showCommand, waitCommand } from "./commands/agents.ts";
import { openCallLimitModule, ttlModule } from "./config.ts";
import type { AgentsDeps } from "./use-cases/deps.ts";

export type { AgentsDeps } from "./use-cases/deps.ts";
export type { AgentView } from "./use-cases/registry.ts";
export {
  endStaleSessions,
  findView,
  leaseOf,
  recordEnd,
  recordLink,
  recordStart,
} from "./use-cases/registry.ts";

export const agentsConfig = {
  modules: [ttlModule, openCallLimitModule],
  prompts: [],
};

export function agentsRegistrations(deps: AgentsDeps): Registration[] {
  return [
    { id: "agents-list", handler: listCommand(deps), resolvesChange: "handler" },
    { id: "agents-show", handler: showCommand(deps) },
    { id: "agents-wait", handler: waitCommand(deps) },
  ];
}
