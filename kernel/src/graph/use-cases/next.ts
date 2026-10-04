// `bdk next` (`kernel-cli/graph`): the first actionable node with its
// instruction, or what the Change waits for. Never writes.
import { executionTreeModule, executionWorktreeModule } from "../config.ts";
import { fillTemplate } from "../domain/instruction.ts";
import { stageCommand, stageOfTarget } from "../domain/pipeline.ts";
import { nodeView } from "../domain/reports.ts";
import type { NextOutcome } from "../domain/reports.ts";
import { executeWave } from "../domain/wave.ts";
import type { WaveItem } from "../domain/wave.ts";
import { withChangeIndex } from "../../log/index.ts";
import { moduleValue, promptContent } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  filesOverlap,
  isolationOf,
  kernelWorktrees,
  openAttempts,
  readPlanParts,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import type { ChangeGraph } from "./graph.ts";
import { gateViews, readGraph, stageOfChange } from "./graph.ts";
import { instructionOf } from "./instruction.ts";

export function nextStep(
  deps: GraphDeps,
  change: ActiveChange,
  globalDir: string,
): Promise<NextOutcome | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const base = { change: change.id, stage: stageOfChange(read), gates: gateViews(read) };
    if (read.parked !== undefined) {
      return {
        report: { ...base, waiting: "user" },
        parked: {
          entry: read.parked.id,
          summary: read.parked.summary,
          options: read.parked.options ?? [],
        },
      };
    }
    const { next, waitingGate } = read.graph;
    if (next !== undefined) {
      const command = stageCommand(read.pipeline, stageOfTarget(read.pipeline, next.id));
      return {
        report: {
          ...base,
          artifact: nodeView(next),
          ...(command === undefined ? {} : { command }),
          instruction: instructionOf(deps, change, read, next),
          ...(next.kind === "execute-part"
            ? { wave: await waveOf(deps, change, read, index) }
            : {}),
        },
      };
    }
    if (waitingGate !== undefined) {
      const value = read.resolved.prompts.values.get("pipeline/gate");
      return {
        report: { ...base, waiting: "gate" },
        ...(value === undefined
          ? {}
          : {
              gateText: fillTemplate(promptContent(deps.store, value), {
                change: change.id,
                node: waitingGate.gate,
                profile: read.view.profile,
                paths: [],
              }),
            }),
      };
    }
    return { report: { ...base, waiting: "nothing" } };
  });
}

async function waveOf(
  deps: GraphDeps,
  change: ActiveChange,
  read: ChangeGraph,
  index: IndexDb,
): Promise<WaveItem[]> {
  const parts = readPlanParts(deps.store, change.dir);
  const worktrees = parts.some((part) => isolationOf(part.data) === "worktree")
    ? await kernelWorktrees(deps.git, deps.store, change.projectRoot)
    : [];
  const started = new Set(
    read.entries.flatMap((entry) =>
      entry.type === "transition" &&
      entry.source === "kernel" &&
      entry.to?.startsWith("execute-part:") === true
        ? [entry.to.slice("execute-part:".length)]
        : [],
    ),
  );
  return executeWave({
    graph: read.graph,
    profile: read.view.profile,
    tree: moduleValue(executionTreeModule, read.resolved.value),
    files: new Map(
      parts.map((part) => [
        part.id,
        part.tasks.flatMap((task) => task.files.map((file) => file.path)),
      ]),
    ),
    overlap: filesOverlap,
    started,
    tickets: openAttempts(index, change.id),
    isolation: new Map(parts.map((part) => [part.id, isolationOf(part.data)])),
    worktree: moduleValue(executionWorktreeModule, read.resolved.value),
    live: new Map(
      worktrees
        .filter((found) => found.change === change.id)
        .map((found) => [found.part, found.path]),
    ),
    liveCount: worktrees.length,
  });
}
