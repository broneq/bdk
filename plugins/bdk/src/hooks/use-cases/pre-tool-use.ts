// `bdk hooks pre-tool-use -` (spec `bdk-cli/hooks`, "Subagent git guard"): the payload first, the
// command next, the configuration last, so most calls never touch the file system.

import { loadConfig } from "../../config/index.ts";
import { historyChange } from "../domain/git-history.ts";
import { denyReason, workerBash } from "../domain/guard.ts";
import type { PreToolUseResult } from "../schema/pre-tool-use.ts";
import { readPayload, sessionDeps } from "./payload.ts";
import type { HooksDeps } from "./payload.ts";

const ALLOW: PreToolUseResult = { decision: "allow", command: null, reason: null };

export async function preToolUse(deps: HooksDeps): Promise<PreToolUseResult> {
  const payload = await readPayload(deps);
  if (!workerBash(payload)) return ALLOW;
  const command = historyChange(payload.command ?? "");
  if (command === undefined) return ALLOW;
  const config = loadConfig(sessionDeps(deps, payload));
  if (config.status !== "ok" || !config.settings.hooks["subagent-git"]) return ALLOW;
  return { decision: "deny", command, reason: denyReason(command) };
}
