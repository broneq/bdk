// The gates of a Change as `hooks prompt-expansion` passes them (T24 design
// D-12): each gate node with the stage it opens, its resolved `policy.gates`
// value and its status, and the stage a typed command names.
import type { GraphNode } from "../domain/engine.ts";
import type { GatePolicy, GateStatus } from "../domain/gate.ts";
import { GATE_KIND } from "../domain/pipeline.ts";
import type { GateView } from "../domain/reports.ts";
import type { GraphDeps } from "./deps.ts";
import { gatesOf, gateViews, kindsOf } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";
import { loadPipeline } from "./pipeline.ts";

export interface StageGate {
  readonly node: GraphNode;
  /** The stage the gate opens. */
  readonly opens: string;
  readonly policy: GatePolicy;
  /** Absent when the gate is skipped in this Change's profile. */
  readonly status?: GateStatus;
  readonly view?: GateView;
}

/** The pipeline stage whose `command` is `command` (`/bdk:plan` -> `plan`), if any. */
export function stageOfCommand(deps: GraphDeps, command: string): string | undefined {
  const pipeline = loadPipeline(deps.store, deps.pluginRoot, deps.settings, kindsOf(deps));
  return pipeline.stages.find((stage) => stage.command === command)?.id;
}

/** Every gate node of the graph that opens a stage, in pipeline order. */
export function stageGates(read: ChangeGraph): StageGate[] {
  const policies = gatesOf(read.resolved);
  const views = new Map(gateViews(read).map((view) => [view.gate, view]));
  return read.graph.nodes.flatMap((node) => {
    const opens = node.node.opens;
    if (node.kind !== GATE_KIND || opens === undefined) return [];
    const policy =
      (node.node.policy === undefined ? undefined : policies[node.node.policy]) ?? "manual";
    const view = views.get(node.id);
    const skipped = node.state === "skipped" || node.gate === undefined;
    return [
      {
        node,
        opens,
        policy,
        ...(skipped ? {} : { status: node.gate }),
        ...(skipped || view === undefined ? {} : { view }),
      },
    ];
  });
}
