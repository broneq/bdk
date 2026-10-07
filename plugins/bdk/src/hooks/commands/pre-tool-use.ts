// `bdk hooks pre-tool-use -`, called by the plugin's PreToolUse hook for every Bash call.

import type { Command } from "../../shared/cli/index.ts";
import { renderPreToolUse } from "../render/pre-tool-use.ts";
import type { HooksDeps } from "../use-cases/payload.ts";
import { preToolUse } from "../use-cases/pre-tool-use.ts";
import { PAYLOAD_ARGUMENT, requireStdin } from "./stdin-argument.ts";

export function preToolUseCommand(deps: HooksDeps): Command {
  return {
    verb: "pre-tool-use",
    summary: "PreToolUse hook: deny git history changes of subagents when hooks.subagent-git is on",
    arguments: [PAYLOAD_ARGUMENT],
    async run(input) {
      requireStdin(input, "hooks pre-tool-use");
      const result = await preToolUse(deps);
      return { data: result, text: renderPreToolUse(result) };
    },
  };
}
