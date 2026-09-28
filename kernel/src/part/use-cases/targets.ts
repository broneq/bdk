// What `attempt open` checks a target against: the node states of the
// Change's graph, the started parts and the resolved settings, read once.
// The attempt slice reaches the graph only through this function.
import { postTaskSteps, readGraph } from "../../graph/index.ts";
import type { PostTaskStep } from "../../graph/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { EntryRow, IndexDb } from "../../shared/store/index.ts";
import type { NodeState } from "../../shared/vocabulary/index.ts";
import type { PartDeps } from "./deps.ts";
import { startedParts } from "./parts.ts";

export interface WorkTargets {
  readonly settings: Readonly<Mapping>;
  readonly entries: readonly EntryRow[];
  /** The live park question, or undefined. */
  readonly parked: EntryRow | undefined;
  readonly started: ReadonlySet<string>;
  /** A node's state and why, or undefined when the graph has no such node. */
  node(id: string): { readonly state: NodeState; readonly why?: string } | undefined;
  /** The post-task steps the Change's graph applies, in pipeline order (T23-D41). */
  readonly steps: readonly PostTaskStep[];
}

export async function workTargets(
  deps: PartDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
): Promise<WorkTargets | Refusal> {
  const read = await readGraph(deps, change, index, globalDir);
  if ("refused" in read) return read;
  return {
    settings: read.resolved.value,
    entries: read.entries,
    parked: read.parked,
    started: startedParts(read.entries),
    steps: postTaskSteps(read),
    node: (id) => {
      const found = read.graph.find(id);
      if (found === undefined) return undefined;
      return found.why === undefined
        ? { state: found.state }
        : { state: found.state, why: found.why };
    },
  };
}
