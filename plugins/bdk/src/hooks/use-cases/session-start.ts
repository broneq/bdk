// `bdk hooks session-start -` (spec `bdk-cli/hooks`, "Session start context" and "Session start
// warning without configuration"; design D7, content from Change v3-285-session-start-context D2).

import { loadConfig } from "../../config/index.ts";
import type { SessionStartResult } from "../schema/session-start.ts";
import { readPayload, sessionDeps } from "./payload.ts";
import type { HooksDeps } from "./payload.ts";

/** The same lines `bdk config show` prints for these states. */
const NOT_CONFIGURED = "BDK not configured: run /bdk:setup";
const INVALID = "BDK configuration invalid: run bdk config check";

/** How work is done in a BDK project, after the line naming the root; the same in every project. */
const PROCESS = [
  "Work with behaviour to specify runs as an OpenSpec Change through the BDK stages: " +
    "/bdk:propose, /bdk:design, /bdk:plan, /bdk:execute, /bdk:auto-review, /bdk:close.",
  "/bdk:run carries an intent or a list of issues through every stage to a pull request; " +
    "/bdk:debug fixes a reported bug that needs diagnosis; /bdk:pr-review reviews a pull request.",
  "A stage that stopped resumes from its files (openspec/changes/, .bdk/runs/): " +
    "run the same command again to continue it.",
  "A small edit you can see whole (a typo, a version bump, a one-line fix) is done directly, " +
    "without a Change.",
];

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
    ...PROCESS,
  ];
  return { status: "ok", root: config.root, context: lines.join("\n"), warning: null };
}
