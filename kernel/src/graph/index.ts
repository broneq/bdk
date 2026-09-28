// The graph slice (`kernel-cli/graph`, `kernel-pipeline`): `next`, `explain`,
// `validate` and `done` over the shipped pipeline. The `change` slice reads
// node states and gates through `changeGraph`.
import type { Registration } from "../shared/registry/index.ts";
import { doneCommand, explainCommand, nextCommand, validateCommand } from "./commands/graph.ts";
import { pipelinePrompts, gatesModule } from "./config.ts";
import type { GraphDeps } from "./use-cases/deps.ts";

export type { GraphDeps } from "./use-cases/deps.ts";
export { changeGraph, graphSummary, stageResolver } from "./use-cases/status.ts";
export { readGraph } from "./use-cases/graph.ts";
export { artifactPaths } from "./use-cases/paths.ts";
export { postTaskSteps, targetSteps } from "./use-cases/steps.ts";
export type { PostTaskStep } from "./use-cases/steps.ts";
export type { ChangeGraph } from "./use-cases/graph.ts";
export { checksOf } from "./use-cases/validate.ts";
export { writeDoneMarker } from "./use-cases/done.ts";

export const graphConfig = {
  modules: [gatesModule],
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
