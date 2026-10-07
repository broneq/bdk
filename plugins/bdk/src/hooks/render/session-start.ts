// The host output of `bdk hooks session-start -` (spec `bdk-cli/hooks`, "Hook output"; design
// D3): the context for the model, or the one warning for the user and nothing for the model.

import type { SessionStartResult } from "../schema/session-start.ts";

export function renderSessionStart(result: SessionStartResult): string {
  if (result.context === null) return JSON.stringify({ systemMessage: result.warning });
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: result.context },
  });
}
