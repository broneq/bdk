// The host output of `bdk hooks pre-tool-use -` (spec `bdk-cli/hooks`, "Hook output"; design D3):
// the PreToolUse deny object, or `{}`, which leaves the decision to the host.

import type { PreToolUseResult } from "../schema/pre-tool-use.ts";

export function renderPreToolUse(result: PreToolUseResult): string {
  if (result.decision === "allow") return "{}";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: result.reason,
    },
  });
}
