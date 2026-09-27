// `bdk next` (`kernel-cli/graph`): the first actionable node with its
// instruction, or what the Change waits for. Never writes.
import { fillTemplate } from "../domain/instruction.ts";
import { nodeView } from "../domain/reports.ts";
import type { NextOutcome } from "../domain/reports.ts";
import { withChangeIndex } from "../../log/index.ts";
import { promptContent } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { GraphDeps } from "./deps.ts";
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
