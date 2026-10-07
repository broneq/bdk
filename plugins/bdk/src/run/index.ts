// The `run` command group (spec `bdk-cli/run`): renders the state of an autopilot run from
// `.bdk/runs/` and the OpenSpec Changes. It reads; the run's skills write.

import type { Group } from "../shared/cli/index.ts";
import { statusCommand } from "./commands/status.ts";
import type { RunDeps } from "./use-cases/status.ts";

export type { RunDeps } from "./use-cases/status.ts";

export function runGroup(deps: RunDeps): Group {
  return {
    name: "run",
    summary: "State of an autopilot run",
    commands: [statusCommand(deps)],
  };
}
