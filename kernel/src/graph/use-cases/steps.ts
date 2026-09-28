// The post-task steps of a target (`kernel-pipeline`, Artifact kinds;
// T23-D40, D44): the step kinds in the order of their nodes in the pipeline,
// each with the role that runs it, and the target's executable files, which a
// runner package puts in place of `{files}`.
import { PostTaskStepKind } from "../domain/kinds/index.ts";
import { fileClass, filePolicy } from "../../evidence/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readPlanParts, taskHolders } from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";

interface PostTaskStep {
  readonly kind: string;
  readonly role: Role;
}

export interface TargetSteps {
  /** In pipeline order; a step node the Change skips is left out. */
  readonly steps: readonly PostTaskStep[];
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
  const steps = new Map<string, PostTaskStep>();
  for (const node of read.graph.nodes) {
    const kind = read.kinds.get(node.kind);
    if (!(kind instanceof PostTaskStepKind) || node.state === "skipped") continue;
    steps.set(kind.name, { kind: kind.name, role: kind.role });
  }
  const policy = filePolicy(read.resolved.value);
  const files = [...new Set(targetFiles(readPlanParts(deps.store, change.dir), target))]
    .filter((path) => fileClass(policy, path) === "executable")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { steps: [...steps.values()], files };
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
