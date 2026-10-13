// The `check` command group (spec `bdk-cli/check`): resolves the project's configured checks into
// lines the agent runs itself, and records their result in the Change's run directory.

import type { Group } from "../shared/cli/index.ts";
import { planCommand } from "./commands/plan.ts";
import { recordCommand } from "./commands/record.ts";
import type { CheckDeps } from "./use-cases/deps.ts";

export type { CheckDeps } from "./use-cases/deps.ts";

export function checkGroup(deps: CheckDeps): Group {
  return {
    name: "check",
    summary: "Plan the project's test, lint and build commands and record their result",
    commands: [planCommand(deps), recordCommand(deps)],
  };
}
