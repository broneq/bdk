// `bdk next` (`kernel-cli/graph`): the first actionable node with its
// instruction, or what the Change waits for. Never writes.
import { executionTreeModule } from "../config.ts";
import { fillTemplate } from "../domain/instruction.ts";
import { nodeView } from "../domain/reports.ts";
import type { NextOutcome } from "../domain/reports.ts";
import { executeWave } from "../domain/wave.ts";
import type { WaveItem } from "../domain/wave.ts";
import { withChangeIndex } from "../../log/index.ts";
import { moduleValue, promptContent } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { openAttempts } from "../../shared/store/index.ts";
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
      return {
        report: {
          ...base,
          artifact: nodeView(next),
          instruction: instructionOf(deps, change, read, next),
          ...(next.kind === "execute-part" ? { wave: waveOf(read, index, change.id) } : {}),
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

function waveOf(read: ChangeGraph, index: IndexDb, changeId: string): WaveItem[] {
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
    started,
    tickets: openAttempts(index, changeId),
  });
}
