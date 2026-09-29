// The execute A/B measurement (design D-7), loaded by the harness's extension
// hook after every run. Kernel state and git are read before the acceptance
// checks copy the hidden tests into the working copy.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { EvalResult, Measurement, RunContext, SuiteHooks } from "../../harness/hook.ts";
import { judge } from "../../harness/judge.ts";
import {
  acceptance,
  acceptanceScore,
  envelopeBytes,
  kernelCalls,
  readV2State,
  readV3State,
  v2Completeness,
  v3Completeness,
} from "./metrics.ts";
import type { Exec } from "./metrics.ts";
import { TASK_DIR, readTask, v2Groups } from "./seed.ts";
import type { Arm } from "./suite.ts";

const HIDDEN_DIR = fileURLToPath(new URL("./hidden", import.meta.url));

/** Ten minutes per check: the fixture's whole suite takes seconds; a hang is a failure. */
const CHECK_TIMEOUT_MS = 600_000;

const runCheck: Exec = (command, args, cwd) =>
  spawnSync(command, args, { cwd, stdio: "ignore", timeout: CHECK_TIMEOUT_MS }).status ?? 1;

const RUBRIC_SYSTEM = [
  "You check the final message of a coding agent that executed a plan.",
  "You get the end state the tools recorded and the agent's final message.",
  "The message is accurate when every claim it makes about finished parts, committed tasks and failures matches the recorded state.",
  "Leaving out details is fine. Claiming work as done that the state does not show, or not reporting a failure or unfinished work the state shows, is inaccurate.",
].join(" ");

const RUBRIC_SCHEMA = {
  type: "object",
  properties: { accurate: { type: "boolean" }, reason: { type: "string" } },
  required: ["accurate", "reason"],
  additionalProperties: false,
};

export interface HookDeps {
  readonly judge: typeof judge;
  readonly exec: Exec;
}

async function rubric(
  deps: HookDeps,
  finalMessage: string,
  endState: unknown,
): Promise<{ score: number; cost: number; models: readonly string[] }> {
  if (finalMessage.trim() === "") return { score: 0, cost: 0, models: [] };
  const verdict = await deps.judge({
    system: RUBRIC_SYSTEM,
    prompt: `Recorded end state:\n${JSON.stringify(endState, null, 2)}\n\nFinal message:\n${finalMessage}`,
    schema: RUBRIC_SCHEMA,
  });
  const accurate = (verdict.output as { accurate?: unknown }).accurate === true;
  return { score: accurate ? 1 : 0, cost: verdict.cost, models: verdict.models };
}

async function measure(
  deps: HookDeps,
  context: RunContext,
  result: EvalResult,
): Promise<Measurement> {
  const workDir = context.cell.workDir;
  if (workDir === null) throw new Error(`cell ${context.cellName} has no working copy`);
  const arm = context.cell.settings.arm as Arm;
  const toolCalls = result.response?.metadata?.toolCalls ?? [];
  const task = readTask(TASK_DIR);
  const parts = task.parts.map((part) => ({
    id: part.id,
    tasks: part.tasks.map((entry) => entry.id),
  }));
  const taskCount = parts.reduce((sum, part) => sum + part.tasks.length, 0);

  let completeness: number;
  let kernel: Record<string, number | null> = {
    kernel_calls: null,
    exit3: null,
    exit2: null,
    envelope_bytes: null,
  };
  let templateHashes: string[] = [];
  let endState: unknown;
  if (arm === "v2") {
    const state = readV2State(workDir);
    const groups = v2Groups(task);
    completeness = v2Completeness({ groups, tasks: taskCount }, toolCalls, state);
    endState = {
      groupsExpected: groups,
      groupsCommitted: state.groups,
      manifestGroupsDone: state.manifestGroups,
    };
  } else {
    const state = readV3State(workDir);
    completeness = v3Completeness(parts, state);
    const calls = kernelCalls(toolCalls);
    kernel = {
      kernel_calls: calls.calls,
      exit3: calls.exit3,
      exit2: calls.exit2,
      envelope_bytes: envelopeBytes(toolCalls),
    };
    templateHashes = [
      ...new Set(
        state.packages.flatMap((entry) =>
          entry.templateHash === null ? [] : [entry.templateHash],
        ),
      ),
    ].sort();
    endState = {
      parts: parts.map((part) => ({
        part: part.id,
        tasks: part.tasks,
        done: state.partsDone.includes(part.id),
      })),
      tasksCommitted: state.trailerTasks,
      tickets: state.attempts.map((entry) => ({
        task: entry.target,
        outcome: entry.outcome ?? "open",
      })),
    };
  }

  const checks = acceptance(workDir, HIDDEN_DIR, deps.exec);
  const output = result.response?.output;
  const graded = await rubric(
    deps,
    typeof output === "string" ? output : JSON.stringify(output ?? ""),
    endState,
  );
  const turns = result.response?.metadata?.numTurns;
  return {
    metrics: {
      acceptance: acceptanceScore(checks),
      completeness,
      turns: turns ?? null,
      wall_s: result.latencyMs === undefined ? null : result.latencyMs / 1000,
      ...kernel,
      rubric: graded.score,
    },
    extraCost: graded.cost,
    templateHashes,
    models: graded.models,
  };
}

export function createHooks(deps: HookDeps): SuiteHooks {
  return { measure: (context, result) => measure(deps, context, result) };
}

export const hooks = createHooks({ judge, exec: runCheck });
