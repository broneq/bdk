// `bdk hooks session-start -` (spec `bdk-cli/hooks`, "Session start context" and "Session start
// warning without configuration"; design D7).

import { loadConfig } from "../../config/index.ts";
import { LEAD } from "../domain/guard.ts";
import type { SessionStartResult } from "../schema/session-start.ts";
import { readPayload, sessionDeps } from "./payload.ts";
import type { HooksDeps } from "./payload.ts";

/** The same lines `bdk config show` prints for these states. */
const NOT_CONFIGURED = "BDK not configured: run /bdk:setup";
const INVALID = "BDK configuration invalid: run bdk config check";

export async function sessionStart(deps: HooksDeps): Promise<SessionStartResult> {
  const config = loadConfig(sessionDeps(deps, await readPayload(deps)));
  if (config.status === "not-configured") {
    return { status: config.status, root: config.root, context: null, warning: NOT_CONFIGURED };
  }
  if (config.status === "invalid") {
    return { status: config.status, root: config.root, context: null, warning: INVALID };
  }
  const lines = [
    `BDK (Broneq Dev Kit) is configured in this project, root ${config.root}.`,
    "Run `bdk config show` for the resolved configuration and `bdk --help` for the CLI helpers.",
    ...(config.settings.hooks["subagent-git"]
      ? [
          `hooks.subagent-git is on: subagents other than ${LEAD} may not change git history; ` +
            "they leave changes in the working tree for the lead or the main thread to commit.",
        ]
      : []),
  ];
  return { status: "ok", root: config.root, context: lines.join("\n"), warning: null };
}
