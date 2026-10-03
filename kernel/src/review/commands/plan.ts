// The `review plan` handler: flags in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderPlan } from "../render/plan.ts";
import { reviewPlan } from "../use-cases/plan.ts";
import type { ReviewDeps } from "../use-cases/plan.ts";

export function planCommand(deps: ReviewDeps): Handler {
  return async (context) => {
    // The registry sets `change` for every Change-scoped record before the handler runs.
    if (context.change === undefined) throw new Error("review plan is Change-scoped");
    const base = context.flags["--base"];
    const plan = await reviewPlan(deps, context.change, {
      full: context.flags["--full"] === true,
      base: typeof base === "string" ? base : undefined,
      globalDir: globalDir(context.runtime),
    });
    return isRefusal(plan) ? plan : { data: plan, text: renderPlan(plan) };
  };
}
