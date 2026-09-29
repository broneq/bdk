// The rules no-op measurement (design D-8), loaded by the harness's extension
// hook after every run. An M1 run's answer is judged COVERED, MISSED or WRONG
// against its bullet; an M2 run's review is judged per seeded violation, and
// the distinct problems it claims are counted for the clean controls.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { rawDirOf } from "../../harness/hook.ts";
import type { EvalResult, Measurement, RunContext, SuiteHooks } from "../../harness/hook.ts";
import { judge } from "../../harness/judge.ts";
import type { JudgeRequest, Judgement } from "../../harness/judge.ts";
import { readBullets } from "./bullets.ts";
import type { Bullet } from "./bullets.ts";
import { readViolations, violationKey } from "./patches.ts";
import type { Violations } from "./patches.ts";
import { CLAIMED, OUTCOME_VALUE } from "./table.ts";
import type { Outcome } from "./table.ts";

export type MeasurementKind = "m1" | "m2";

/** Both judge prompts ask for it; every uncertain judgement is spot-checked (design D-6). */
const UNCERTAIN =
  "Set uncertain to true when the call is close or the text is ambiguous, so a person checks it.";

/** A row's metric: 1 when the judge marked its judgement uncertain. */
export const UNCERTAIN_METRIC = "uncertain";

const KNOWLEDGE_SYSTEM = [
  "You grade an answer against one engineering rule.",
  "COVERED: the answer states the rule's point in substance, in any words.",
  "MISSED: the answer does not state it, or states only something else.",
  "WRONG: the answer recommends the opposite of the rule or contradicts it.",
  "Judge the substance only; length, style and extra advice do not count either way.",
  UNCERTAIN,
].join(" ");

const KNOWLEDGE_SCHEMA = {
  type: "object",
  properties: {
    outcome: { type: "string", enum: ["COVERED", "MISSED", "WRONG"] },
    reason: { type: "string" },
    uncertain: { type: "boolean" },
  },
  required: ["outcome", "reason", "uncertain"],
  additionalProperties: false,
};

const DETECTION_SYSTEM = [
  "You check a code review against a list of problems known to be in the reviewed change.",
  "For each listed problem, found is true when the review names that problem at that place, or names the same defect in its own words at the same code; a review that only names the rule in general, or another problem at that line, does not find it.",
  "claimed is the number of distinct problems the review reports, known or not; `no findings` is 0.",
  UNCERTAIN,
].join(" ");

const DETECTION_SCHEMA = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, found: { type: "boolean" } },
        required: ["id", "found"],
        additionalProperties: false,
      },
    },
    claimed: { type: "integer", minimum: 0 },
    uncertain: { type: "boolean" },
  },
  required: ["problems", "claimed", "uncertain"],
  additionalProperties: false,
};

export interface HookDeps {
  readonly judge: typeof judge;
  readonly bullets: () => readonly Bullet[];
  readonly violations: () => Violations;
  /** Keeps the judge's request and answer with the run's raw records, for the spot-check. */
  readonly record: (context: RunContext, request: JudgeRequest, judgement: Judgement) => void;
}

function uncertainOf(output: unknown): number {
  return (output as { uncertain?: unknown }).uncertain === true ? 1 : 0;
}

async function judged(
  deps: HookDeps,
  context: RunContext,
  request: JudgeRequest,
): Promise<Judgement> {
  const judgement = await deps.judge(request);
  deps.record(context, request, judgement);
  return judgement;
}

/** The text of a one-turn reply: a string, or the text of its content blocks. */
export function replyText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((block) =>
        typeof block === "string"
          ? block
          : typeof (block as { text?: unknown }).text === "string"
            ? (block as { text: string }).text
            : "",
      )
      .filter((text) => text !== "")
      .join("\n");
  }
  return "";
}

async function knowledge(deps: HookDeps, context: RunContext, reply: string): Promise<Measurement> {
  const bullet = deps.bullets().find((entry) => entry.id === context.item);
  if (bullet === undefined) throw new Error(`no rule bullet ${context.item}`);
  const verdict = await judged(deps, context, {
    system: KNOWLEDGE_SYSTEM,
    prompt: `Rule:\n${bullet.text}\n\nQuestion:\n${context.vars.question ?? ""}\n\nAnswer:\n${reply}`,
    schema: KNOWLEDGE_SCHEMA,
  });
  const outcome = (verdict.output as { outcome?: unknown }).outcome;
  if (typeof outcome !== "string" || !(outcome in OUTCOME_VALUE)) {
    throw new Error(`judge returned no outcome: ${JSON.stringify(verdict.output)}`);
  }
  return {
    metrics: {
      knowledge: OUTCOME_VALUE[outcome as Outcome],
      [UNCERTAIN_METRIC]: uncertainOf(verdict.output),
    },
    extraCost: verdict.cost,
    templateHashes: [],
    models: verdict.models,
  };
}

async function detection(deps: HookDeps, context: RunContext, reply: string): Promise<Measurement> {
  const entry = deps.violations().patches.find((patch) => patch.patch === context.item);
  if (entry === undefined) throw new Error(`no seeded patch ${context.item}`);
  const bullets = deps.bullets();
  const listed = entry.violations.map((violation, index) => ({
    id: `P${String(index + 1)}`,
    key: violationKey(violation),
    text: `P${String(index + 1)}: ${violation.file}:${String(violation.line)}: ${violation.what} (rule: ${bullets.find((bullet) => bullet.id === violation.bullet)?.text ?? violation.bullet})`,
  }));
  const verdict = await judged(deps, context, {
    system: DETECTION_SYSTEM,
    prompt: [
      "Known problems:",
      listed.length === 0
        ? "(none: judge only claimed)"
        : listed.map((item) => item.text).join("\n"),
      "",
      "Review:",
      reply,
    ].join("\n"),
    schema: DETECTION_SCHEMA,
  });
  const output = verdict.output as {
    problems?: readonly { id?: unknown; found?: unknown }[];
    claimed?: unknown;
  };
  if (typeof output.claimed !== "number") {
    throw new Error(`judge returned no claimed count: ${JSON.stringify(verdict.output)}`);
  }
  const metrics: Record<string, number> = {
    [CLAIMED]: output.claimed,
    [UNCERTAIN_METRIC]: uncertainOf(verdict.output),
  };
  for (const item of listed) {
    const judged = output.problems?.find((problem) => problem.id === item.id);
    if (judged === undefined || typeof judged.found !== "boolean") {
      throw new Error(`judge skipped ${item.id}: ${JSON.stringify(verdict.output)}`);
    }
    metrics[item.key] = judged.found ? 1 : 0;
  }
  return { metrics, extraCost: verdict.cost, templateHashes: [], models: verdict.models };
}

async function measure(
  deps: HookDeps,
  context: RunContext,
  result: EvalResult,
): Promise<Measurement> {
  const reply = replyText(result.response?.output);
  // An empty reply is a failed call, not an answer: the run is discarded.
  if (reply.trim() === "") throw new Error("empty reply");
  const kind = context.cell.settings.measurement as MeasurementKind;
  return kind === "m1" ? knowledge(deps, context, reply) : detection(deps, context, reply);
}

export function createHooks(deps: HookDeps): SuiteHooks {
  return { measure: (context, result) => measure(deps, context, result) };
}

function recordJudgement(context: RunContext, request: JudgeRequest, judgement: Judgement): void {
  const dir = rawDirOf(context);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "judge.json"),
    `${JSON.stringify({ prompt: request.prompt, answer: judgement.output }, null, 2)}\n`,
  );
}

export const hooks = createHooks({
  judge,
  bullets: readBullets,
  violations: readViolations,
  record: recordJudgement,
});
