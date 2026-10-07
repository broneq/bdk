// `bdk hooks session-start -`, called by the plugin's SessionStart hook.

import type { Command } from "../../shared/cli/index.ts";
import { renderSessionStart } from "../render/session-start.ts";
import type { HooksDeps } from "../use-cases/payload.ts";
import { sessionStart } from "../use-cases/session-start.ts";
import { PAYLOAD_ARGUMENT, requireStdin } from "./stdin-argument.ts";

export function sessionStartCommand(deps: HooksDeps): Command {
  return {
    verb: "session-start",
    summary: "SessionStart hook: a short BDK context, or one warning without a configuration",
    arguments: [PAYLOAD_ARGUMENT],
    async run(input) {
      requireStdin(input, "hooks session-start");
      const result = await sessionStart(deps);
      return { data: result, text: renderSessionStart(result) };
    },
  };
}
