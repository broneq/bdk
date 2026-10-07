// The `hooks` command group (spec `bdk-cli/hooks`): the commands the plugin's hooks call. They
// speak the host's hook protocol on stdout and exit 0 for every decision.

import type { Group } from "../shared/cli/index.ts";
import { preToolUseCommand } from "./commands/pre-tool-use.ts";
import { sessionStartCommand } from "./commands/session-start.ts";
import type { HooksDeps } from "./use-cases/payload.ts";

export type { HooksDeps } from "./use-cases/payload.ts";

export function hooksGroup(deps: HooksDeps): Group {
  return {
    name: "hooks",
    summary: "Hook commands of the bdk plugin (SessionStart, PreToolUse)",
    commands: [preToolUseCommand(deps), sessionStartCommand(deps)],
  };
}
