// The post-task steps of a target (`kernel-pipeline`, Artifact kinds;
// T23-D40, D44): the step kinds in the order of their nodes in the pipeline,
// each with the role that runs it or the kernel command that records it, and the target's executable files, which a
// runner package puts in place of `{files}`. Also what keeps a review round
// from opening: the change-level checks run inside the round (T42-D4).
import { ChangeCheckKind, PostTaskStepKind } from "../domain/kinds/index.ts";
import { fileClass, filePolicy } from "../../evidence/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readPlanParts, taskHolders } from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import type { NodeState, Role } from "../../shared/vocabulary/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";

/** A step an agent of `role` runs, or one the kernel records through `command` (#166). */
export type PostTaskStep =
  | { readonly kind: string; readonly role: Role }
  | { readonly kind: string; readonly command: string };

export interface TargetSteps {
  /** In pipeline order; a step node the Change skips is left out. */
  readonly steps: readonly PostTaskStep[];
  /** The change-level check kinds the Change applies, in pipeline order (T42-D4, T49). */
  readonly checks: readonly string[];
  /** The target's `Files:` that are neither non-executable nor build config, in byte order. */
  readonly files: readonly string[];
}

export async function targetSteps(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  target: string,
): Promise<TargetSteps | Refusal> {
  const read = await readGraph(deps, change, index, globalDir);
  if ("refused" in read) return read;
  const policy = filePolicy(read.resolved.value);
  const files = [...new Set(targetFiles(readPlanParts(deps.store, change.dir), target))]
    .filter((path) => fileClass(policy, path) === "executable")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { steps: postTaskSteps(read), checks: changeChecks(read), files };
}

/** The change-level check kinds the Change's graph applies, a skipped one left out. */
function changeChecks(read: ChangeGraph): string[] {
  return read.graph.nodes
    .filter(
      (node) => node.state !== "skipped" && read.kinds.get(node.kind) instanceof ChangeCheckKind,
    )
    .map((node) => node.kind);
}

/** The post-task step kinds the Change's graph applies, in pipeline order. */
export function postTaskSteps(read: ChangeGraph): PostTaskStep[] {
  const steps = new Map<string, PostTaskStep>();
  for (const node of read.graph.nodes) {
    const kind = read.kinds.get(node.kind);
    if (!(kind instanceof PostTaskStepKind) || node.state === "skipped") continue;
    steps.set(
      kind.name,
      kind.role === undefined
        ? { kind: kind.name, command: "bdk check run" }
        : { kind: kind.name, role: kind.role },
    );
  }
  return [...steps.values()];
}

/**
 * The first requirement of `review` that blocks a `review-fix` round: not done
 * and not a change-level check, since the round's gate runner records those.
 * Undefined when the round may open or the graph has no `review` node.
 */
export function reviewRoundBlocker(
  read: ChangeGraph,
): { readonly id: string; readonly state: NodeState; readonly why?: string } | undefined {
  for (const id of read.graph.find("review")?.requires ?? []) {
    const node = read.graph.find(id);
    if (node === undefined || node.state === "done" || node.state === "skipped") continue;
    if (read.kinds.get(node.kind) instanceof ChangeCheckKind) continue;
    return node.why === undefined
      ? { id, state: node.state }
      : { id, state: node.state, why: node.why };
  }
  return undefined;
}

/** A task's `Files:`, a part's, or every part's for any other target. */
function targetFiles(parts: readonly PlanPartFile[], target: string): string[] {
  const holder = taskHolders(parts).get(target);
  const tasks =
    holder !== undefined
      ? holder.tasks.filter((task) => task.id === target)
      : (parts.find((part) => part.id === target) ?? { tasks: parts.flatMap((part) => part.tasks) })
          .tasks;
  return tasks.flatMap((task) => task.files.map((file) => file.path));
}
