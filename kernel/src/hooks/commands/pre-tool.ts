import type { Handler } from "../../shared/registry/index.ts";
import { blockReason, isRefusal } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { hookPlace } from "./agent-hooks.ts";
import { preTool } from "../use-cases/pre-tool.ts";

/** A pass is silence, so the host's own permission rules stay in force. */
export function preToolCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const outcome = await preTool(deps, hookPlace(context), context.runtime.readStdin());
    return isRefusal(outcome) ? outcome : { data: outcome, text: "" };
  };
}

/** The host's `PreToolUse` deny object (`kernel-cli/hooks`, Hook payloads). */
export function preToolBlock(refusal: Refusal): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: blockReason(refusal),
    },
  });
}
