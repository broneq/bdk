// `bdk explain <artifact>` (`kernel-cli/graph`): the requires chain of a node
// with each state, hash and reason. A node outside the Change's variant is
// answered as `skipped`.
import { chainOf, nodeView } from "../domain/reports.ts";
import type { ExplainReport } from "../domain/reports.ts";
import { withChangeIndex } from "../../log/index.ts";
import { closest } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";

export function explainNode(
  deps: GraphDeps,
  change: ActiveChange,
  globalDir: string,
  id: string,
): Promise<ExplainReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const node = read.graph.find(id);
    if (node === undefined) return notFound(read, change, id);
    const chain = chainOf(node, read.graph.find);
    const conditions = [
      ...new Set(
        chain.flatMap((item) =>
          item.state !== "skipped" && item.node.if !== undefined ? [item.node.if] : [],
        ),
      ),
    ];
    return {
      artifact: node.id,
      state: node.state,
      chain: chain.map(nodeView),
      profile: read.view.profile,
      ...(conditions.length === 0 ? {} : { conditions }),
    };
  });
}

/** `input/not-found` naming the closest node id of the Change. */
export function notFound(read: ChangeGraph, change: ActiveChange, id: string): Refusal {
  const hint = closest(
    id,
    read.graph.nodes.map((node) => node.id),
  );
  return refuse("input/not-found", `${id} is not a node of ${change.id}'s graph`, [
    hint === undefined ? "bdk change status" : `bdk explain ${hint}`,
    "bdk change status",
  ]);
}
