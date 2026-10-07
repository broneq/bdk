// The `check` command group (spec `bdk-cli/check`): runs the project's configured checks and
// leaves the result in the Change's run directory.

import type { Group } from "../shared/cli/index.ts";
import { runCommand } from "./commands/run.ts";
import type { CheckDeps } from "./use-cases/run.ts";

export type { CheckDeps } from "./use-cases/run.ts";

export function checkGroup(deps: CheckDeps): Group {
  return {
    name: "check",
    summary: "Run the project's test, lint and build commands",
    commands: [runCommand(deps)],
  };
}
