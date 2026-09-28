// What `change status`, `change new`, `change resume` and `change list` read
// from the graph (design D-12): the node and gate views, the stage through the
// pipeline and the stage command the Change continues with.
import { stageCommand, stageMap, stageOfTarget } from "../domain/pipeline.ts";
import { nodeView } from "../domain/reports.ts";
import type { GateView, NodeView } from "../domain/reports.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { IndexDb, StageMap } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import { gateViews, kindsOf, readGraph, stageOfChange } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";
import { loadPipeline } from "./pipeline.ts";

export interface GraphSummary {
  readonly stage: string;
  readonly nodes: readonly NodeView[];
  readonly gates: readonly GateView[];
  /**
   * The stage command of the node `bdk next` returns, or the command of the
   * gate the Change waits for; undefined when parked or nothing is actionable.
   */
  readonly next?: string;
}

/** The graph of a Change whose index `index` has just refreshed. */
export async function changeGraph(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
): Promise<GraphSummary | Refusal> {
  const read = await readGraph(deps, change, index, globalDir);
  return "refused" in read ? read : graphSummary(read);
}

/** The summary of a graph already read, for a caller that also needs the read itself. */
export function graphSummary(read: ChangeGraph): GraphSummary {
  const { graph, pipeline } = read;
  const next =
    read.parked !== undefined
      ? undefined
      : graph.next !== undefined
        ? stageCommand(pipeline, stageOfTarget(pipeline, graph.next.id))
        : graph.waitingGate?.command;
  return {
    stage: stageOfChange(read),
    nodes: graph.nodes.map(nodeView),
    gates: gateViews(read),
    ...(next === undefined ? {} : { next }),
  };
}

/** Maps a transition's `to` to its stage through the shipped pipeline, for Changes read without their graph. */
export function stageResolver(deps: GraphDeps): StageMap {
  return stageMap(loadPipeline(deps.store, deps.pluginRoot, deps.settings, kindsOf(deps)));
}
