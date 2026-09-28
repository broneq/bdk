// `bdk part list` (`kernel-cli/part`): the `execute-part` node state of each
// plan part, its task counts from git, its size and its wave. Never writes.
import { readGraph } from "../../graph/index.ts";
import type { ChangeGraph } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { KernelRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { planWaves, readPlanParts, taskProgress } from "../../shared/store/index.ts";
import type { PlanPartFile } from "../../shared/store/index.ts";
import type { PartItem, PartListReport, PartState } from "../domain/reports.ts";
import type { PartDeps } from "./deps.ts";
import { startedParts } from "./parts.ts";

export function listParts(
  deps: PartDeps,
  change: ActiveChange,
  globalDir: string,
): Promise<PartListReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const items = await partItems(deps, change, read);
    return { items, total: items.length, truncated: false };
  });
}

/** Every plan part of a graph already read; `change status` shows the same items. */
export async function partItems(
  deps: PartDeps,
  change: ActiveChange,
  read: ChangeGraph,
): Promise<PartItem[]> {
  const parts = readPlanParts(deps.store, change.dir);
  const { committed } = await taskProgress(deps.git, change.projectRoot, change.id, parts, []);
  const waves = wavesOf(parts);
  return parts.map((part): PartItem => {
    const dependsOn = part.data["depends-on"];
    const wave = waves?.get(part.id);
    return {
      part: part.id,
      title: part.data.title,
      state: partState(read, part.id),
      tasks: part.tasks.length,
      done: part.tasks.filter((task) => committed.has(task.id)).length,
      bytes: part.bytes,
      ...(dependsOn.length === 0 ? {} : { dependsOn }),
      specImpact: Array.isArray(part.data["spec-impact"]) ? "delta" : "none",
      ...(wave === undefined ? {} : { wave }),
    };
  });
}

/** The node state, `ready` shown as `started` once a `part start` marker exists (T22 design D-8). */
export function partState(read: ChangeGraph, id: string): PartState {
  const node = read.graph.find(`execute-part:${id}`);
  const state = node?.state ?? "blocked";
  if (state === "skipped") return "blocked";
  if (state === "ready" && startedParts(read.entries).has(id)) return "started";
  return state;
}

/** The plan index waves, or undefined when the parts' dependencies do not form a plan. */
function wavesOf(parts: readonly PlanPartFile[]): ReadonlyMap<string, number> | undefined {
  try {
    return planWaves(
      parts.map((part) => ({
        id: part.id,
        title: part.data.title,
        "depends-on": part.data["depends-on"],
      })),
    );
  } catch (error) {
    if (error instanceof KernelRefusal) return undefined;
    throw error;
  }
}
