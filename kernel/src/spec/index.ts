// The spec slice (`kernel-cli/spec`): the delta grammar and checks, the
// deterministic merge into `.bdk/specs/` and its preview (T30). A leaf:
// `graph`'s validators and `change close` call it, never the reverse.
import type { Registration } from "../shared/registry/index.ts";
import { deltaCheckCommand, diffCommand, mergeCommand } from "./commands/spec.ts";
import { specModule } from "./config.ts";
import type { SpecDeps } from "./use-cases/deps.ts";

export type { SpecDeps } from "./use-cases/deps.ts";
export { deltaCapabilities, deltaProblems } from "./use-cases/check.ts";
export { normativeWord } from "./use-cases/files.ts";
export { planMerge, writeMerge } from "./use-cases/merge.ts";
export type { MergePlan } from "./use-cases/merge.ts";
export { mergeHashFindings } from "./use-cases/hash.ts";

export const specConfig = {
  modules: [specModule],
};

export function specRegistrations(deps: SpecDeps): Registration[] {
  return [
    { id: "spec-delta-check", handler: deltaCheckCommand(deps) },
    { id: "spec-merge", handler: mergeCommand(deps) },
    { id: "spec-diff", handler: diffCommand(deps) },
  ];
}
