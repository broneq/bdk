// The `plan` command group (`docs/concepts/stages.md`): checks the plan parts of a Change. It
// reads; the plan skills write.

import type { Group } from "../shared/cli/index.ts";
import { checkCommand } from "./commands/check.ts";
import type { PlanDeps } from "./use-cases/check.ts";

export type { PlanDeps } from "./use-cases/check.ts";

export function planGroup(deps: PlanDeps): Group {
  return {
    name: "plan",
    summary: "Check the plan parts of a Change",
    commands: [checkCommand(deps)],
  };
}
