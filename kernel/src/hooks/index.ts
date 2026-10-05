// The hooks slice (`kernel-cli/hooks`): the content hooks of T13 and the
// guards and `session-end` of T24, and the agent hooks of T41.
import type { Registration } from "../shared/registry/index.ts";
import {
  postToolCommand,
  stopCommand,
  subagentStartCommand,
  subagentStopCommand,
} from "./commands/agent-hooks.ts";
import { preToolBlock, preToolCommand } from "./commands/pre-tool.ts";
import { promptExpansionCommand } from "./commands/prompt-expansion.ts";
import { sessionEndCommand } from "./commands/session-end.ts";
import { sessionStartCommand } from "./commands/session-start.ts";
import { skillExistsCommand } from "./commands/skill-exists.ts";
import { continuationModule, messageModule, scoutModule, verboseModule } from "./config.ts";
import type { HooksDeps } from "./use-cases/input.ts";

export type { HooksDeps } from "./use-cases/input.ts";

export const hooksConfig = {
  modules: [messageModule, continuationModule, scoutModule, verboseModule],
  prompts: [],
};

export function hooksRegistrations(deps: HooksDeps): Registration[] {
  return [
    { id: "hooks-session-start", handler: sessionStartCommand(deps) },
    { id: "hooks-skill-exists", handler: skillExistsCommand(deps) },
    { id: "hooks-session-end", handler: sessionEndCommand(deps) },
    { id: "hooks-pre-tool", handler: preToolCommand(deps), blockOutput: preToolBlock },
    { id: "hooks-post-tool", handler: postToolCommand(deps) },
    { id: "hooks-subagent-start", handler: subagentStartCommand(deps) },
    { id: "hooks-subagent-stop", handler: subagentStopCommand(deps) },
    { id: "hooks-stop", handler: stopCommand(deps) },
    {
      id: "hooks-prompt-expansion",
      handler: promptExpansionCommand(deps),
      resolvesChange: "handler",
    },
  ];
}
