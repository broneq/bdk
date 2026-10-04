// The review slice (`kernel-cli/review`): the range and the reviewer groups
// of a review round, and the human report of a Change (T42). It imports only
// `measure`, for the module signals; `dispatch` reads its risks.
import type { Registration } from "../shared/registry/index.ts";
import { planCommand } from "./commands/plan.ts";
import { renderCommand } from "./commands/render.ts";
import { reviewGroupModule, risksModule, trackerModule } from "./config.ts";
import type { ReviewDeps } from "./use-cases/plan.ts";

export type { ReviewDeps } from "./use-cases/plan.ts";
export { risksModule } from "./config.ts";

export const reviewConfig = {
  modules: [reviewGroupModule, risksModule, trackerModule],
};

export function reviewRegistrations(deps: ReviewDeps): Registration[] {
  return [
    { id: "review-plan", handler: planCommand(deps) },
    { id: "review-render", handler: renderCommand(deps), resolvesChange: "handler" },
  ];
}
