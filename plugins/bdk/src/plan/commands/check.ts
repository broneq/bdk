// `bdk plan check <dir>` (spec `bdk-cli/plan`): exit 1 with the same result when the plan has
// a problem.

import type { Command } from "../../shared/cli/index.ts";
import { renderCheck } from "../render/check.ts";
import { check } from "../use-cases/check.ts";
import type { PlanDeps } from "../use-cases/check.ts";

export function checkCommand(deps: PlanDeps): Command {
  return {
    verb: "check",
    summary: "Check plan parts against the part limits, find depends-on cycles and compute waves",
    arguments: [
      {
        name: "dir",
        description: "The plan/parts directory of a Change",
        required: true,
      },
    ],
    exits: [{ code: 1, when: "the plan has a problem; the result names it" }],
    run({ args }) {
      const result = check(deps, String(args.dir));
      return {
        data: result,
        text: renderCheck(result),
        ...(result.ok ? {} : { exit: 1 as const }),
      };
    },
  };
}
