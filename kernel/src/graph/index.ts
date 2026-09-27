// The graph slice (`kernel-cli/graph`, `kernel-pipeline`): `next`, `explain`,
// `validate` and `done` over the shipped pipeline. The `change` slice reads
// node states and gates through `changeGraph`.
import type { Registration } from "../shared/registry/index.ts";
import { doneCommand, explainCommand, nextCommand, validateCommand } from "./commands/graph.ts";
import { pipelinePrompts, policyModule } from "./config.ts";
import type { GraphDeps } from "./use-cases/deps.ts";

export type { GraphDeps } from "./use-cases/deps.ts";
export { changeGraph, stageResolver } from "./use-cases/status.ts";

export const graphConfig = {
  modules: [policyModule],
  prompts: [...pipelinePrompts],
};

export function graphRegistrations(deps: GraphDeps): Registration[] {
  return [
    { id: "next", handler: nextCommand(deps) },
    { id: "explain", handler: explainCommand(deps) },
    { id: "validate", handler: validateCommand(deps) },
    { id: "done", handler: doneCommand(deps) },
  ];
}
