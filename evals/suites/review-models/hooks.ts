// The review-models measurement (design D10 of v3-t42-review-skills), loaded
// by the harness's extension hook after every run. The entries the review
// rounds wrote are read through kernel commands, the judge matches them to
// the seeded defects of the answer key, and the metrics count what was found
// and what was claimed beyond it.
import { recordJudgement } from "../../harness/hook.ts";
import type { EvalResult, Measurement, RunContext, SuiteHooks } from "../../harness/hook.ts";
import { judge } from "../../harness/judge.ts";
import type { JudgeRequest, Judgement } from "../../harness/judge.ts";
import type { KernelCall } from "../stages/checks.ts";
import { kernelIn } from "../stages/hooks.ts";
import type { KernelSettings } from "../stages/hooks.ts";
import { readKey } from "./key.ts";
import type { AnswerKey } from "./key.ts";
import { readRound } from "./facts.ts";
import { REVIEW_TYPES, reviewMetrics } from "./metrics.ts";
import type { Matches, ReviewEntry } from "./metrics.ts";
import { roundMetrics } from "./round.ts";
import type { RoundFacts } from "./round.ts";

/** A row's metric: 1 when the judge marked its judgement uncertain. */
export const UNCERTAIN_METRIC = "uncertain";

export const MATCH_SYSTEM = [
  "You check the entries of a code review against a list of defects known to be in the reviewed change.",
  "For each defect, list the ids of the entries that describe that defect: the same wrong behaviour or the same missing test at the same code, in any words.",
  "An entry that only names the general topic, or another problem in the same file, does not describe it. An entry may describe more than one defect.",
  "Set uncertain to true when a call is close or an entry is ambiguous, so a person checks it.",
].join(" ");

export const MATCH_SCHEMA = {
  type: "object",
  properties: {
    defects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          entries: { type: "array", items: { type: "string" } },
        },
        required: ["id", "entries"],
        additionalProperties: false,
      },
    },
    uncertain: { type: "boolean" },
  },
  required: ["defects", "uncertain"],
  additionalProperties: false,
};

export interface HookDeps {
  readonly judge: typeof judge;
  readonly key: () => AnswerKey;
  /** One kernel command with `--json` in the run's working copy. */
  readonly kernel: (workDir: string, settings: KernelSettings) => (args: string) => KernelCall;
  /** Keeps the judge's request and answer with the run's raw records, for the spot-check. */
  readonly record: (context: RunContext, request: JudgeRequest, judgement: Judgement) => void;
  /** The round's agents, denials, packages, reports and binary files (#158). */
  readonly round: (
    workDir: string,
    kernel: (args: string) => KernelCall,
    session: string | undefined,
  ) => RoundFacts;
}

interface Listed {
  readonly items?: readonly Record<string, unknown>[];
}

function items(call: KernelCall, command: string): readonly Record<string, unknown>[] {
  if (call.code !== 0) throw new Error(`bdk ${command} failed with exit ${String(call.code)}`);
  return (call.json as Listed | undefined)?.items ?? [];
}

/** The review-fix tickets of the run: the seed opens none, so every one is the review's. */
function reviewTickets(kernel: (args: string) => KernelCall): Set<string> {
  return new Set(
    items(kernel("attempt list --all"), "attempt list")
      .filter((item) => item.loop === "review-fix")
      .map((item) => String(item.ticket)),
  );
}

/** Every finding, blocker and observation a review round wrote, with its body. */
export function reviewEntries(kernel: (args: string) => KernelCall): ReviewEntry[] {
  const tickets = reviewTickets(kernel);
  return items(kernel("log list --all"), "log list")
    .filter(
      (item) =>
        (REVIEW_TYPES as readonly unknown[]).includes(item.type) &&
        tickets.has(String(item.ticket)),
    )
    .map((item) => {
      const id = String(item.id);
      const shown = kernel(`log show ${id}`).json as { entry?: { body?: unknown } } | undefined;
      const body = shown?.entry?.body;
      return {
        id,
        type: String(item.type),
        summary: typeof item.summary === "string" ? item.summary : "",
        refs: Array.isArray(item.refs) ? item.refs.map(String) : [],
        ...(typeof item.level === "string" ? { level: item.level } : {}),
        ...(typeof body === "string" ? { body } : {}),
      };
    });
}

/** The history lines the kernel appends to a body (`Triaged as ...`), which would tell the judge the level. */
const HISTORY_LINE = /^(?:Resolved as|Triaged as|Decided) \S+ at \S+(?::.*)?$/;

export function withoutHistory(body: string): string {
  return body
    .split("\n")
    .filter((line) => !HISTORY_LINE.test(line))
    .join("\n")
    .trimEnd();
}

export function matchRequest(key: AnswerKey, entries: readonly ReviewEntry[]): JudgeRequest {
  const defects = key.defects.map((defect) => ({
    id: defect.id,
    file: defect.file,
    lines: `${String(defect.lines[0])}-${String(defect.lines[1])}`,
    defect: defect.summary,
  }));
  const review = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    refs: entry.refs,
    summary: entry.summary,
    body: withoutHistory(entry.body ?? ""),
  }));
  return {
    system: MATCH_SYSTEM,
    prompt: `Known defects:\n${JSON.stringify(defects, null, 2)}\n\nReview entries:\n${JSON.stringify(review, null, 2)}`,
    schema: MATCH_SCHEMA,
  };
}

async function measure(
  deps: HookDeps,
  context: RunContext,
  result: EvalResult,
): Promise<Measurement> {
  const workDir = context.cell.workDir;
  if (workDir === null) throw new Error(`cell ${context.cellName} has no working copy`);
  const kernel = deps.kernel(workDir, context.cell.settings as unknown as KernelSettings);
  const key = deps.key();
  const entries = reviewEntries(kernel);
  let matches: Matches = { defects: [] };
  let uncertain = 0;
  let cost = 0;
  let models: readonly string[] = [];
  if (entries.length > 0) {
    const request = matchRequest(key, entries);
    const judgement = await deps.judge(request);
    deps.record(context, request, judgement);
    matches = judgement.output as Matches;
    uncertain = (judgement.output as { uncertain?: unknown }).uncertain === true ? 1 : 0;
    cost = judgement.cost;
    models = judgement.models;
  }
  const review = kernel("explain review").json as { state?: unknown } | undefined;
  const round = deps.round(workDir, kernel, result.response?.sessionId);
  return {
    metrics: {
      ...reviewMetrics(key, entries, matches),
      ...roundMetrics(round, entries),
      review_done: review?.state === "done" ? 1 : 0,
      [UNCERTAIN_METRIC]: uncertain,
      turns: result.response?.metadata?.numTurns ?? null,
      wall_s: result.latencyMs === undefined ? null : result.latencyMs / 1000,
    },
    extraCost: cost,
    templateHashes: [],
    models,
  };
}

export function createHooks(deps: HookDeps): SuiteHooks {
  return { measure: (context, result) => measure(deps, context, result) };
}

export const hooks = createHooks({
  judge,
  key: () => readKey(),
  kernel: kernelIn,
  record: recordJudgement,
  round: readRound,
});
