// The review slice (`kernel-cli/review`): the range and the reviewer groups
// of a review round (T42). It imports only `measure`, for the module signals.
import type { Registration } from "../shared/registry/index.ts";
import { planCommand } from "./commands/plan.ts";
import { reviewGroupModule } from "./config.ts";
import type { ReviewDeps } from "./use-cases/plan.ts";

export type { ReviewDeps } from "./use-cases/plan.ts";

export const reviewConfig = {
  modules: [reviewGroupModule],
};

export function reviewRegistrations(deps: ReviewDeps): Registration[] {
  return [{ id: "review-plan", handler: planCommand(deps) }];
}
