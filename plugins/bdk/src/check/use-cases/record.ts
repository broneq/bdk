// `bdk check record` (spec `bdk-cli/check`, "Record the checks"): reads the plan of a check and
// the outputs of the lines the agent ran, and writes the result and, for a round, the findings.

import { addFinding } from "../../findings/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import type { Outcome } from "../domain/verdict.ts";
import {
  bodyOf,
  finding,
  hasTrailer,
  statusOf,
  tailOf,
  trailer,
  verdictOf,
} from "../domain/verdict.ts";
import { checkPlan } from "../schema/plan.ts";
import type { CheckPlan } from "../schema/plan.ts";
import type { RecordResult } from "../schema/record.ts";
import { findingsLog, planPath, resultPath, writeResult } from "../store/results.ts";
import { absolute, checkId, checkRunDir, invalid } from "./deps.ts";
import type { CheckDeps } from "./deps.ts";

export interface RecordInput {
  readonly runDir: string;
  readonly id: string;
  /** `<kind>-<tool>=<code>` per check the agent ran. */
  readonly exits?: readonly string[] | undefined;
  /** `<kind>-<tool>` per check whose call the Bash tool ended at its timeout. */
  readonly timedOut?: readonly string[] | undefined;
  readonly round?: string | undefined;
}

const EXIT = /^([a-z]+-.+)=([0-9]{1,3})$/;

function roundOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw invalid(`--round must be a positive integer, not ${value}`, "record");
  }
  return Number(value);
}

function readPlan(deps: CheckDeps, runDir: string, id: string): CheckPlan {
  const file = planPath(runDir, id);
  const missing = (why: string): CliError =>
    new CliError(
      "env/plan-missing",
      `no plan for ${id}: ${file} ${why}`,
      `Run bdk check plan ${runDir} ${id} first, then each line it prints.`,
    );
  const text = deps.files.readText(absolute(deps, file));
  if (text === undefined) throw missing("does not exist");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw missing("is not JSON");
  }
  const parsed = checkPlan.safeParse(value);
  if (!parsed.success) throw missing("is not a plan of this bdk");
  return parsed.data;
}

/** The outcome of each planned check by its `<kind>-<tool>` key, from `--exit` and `--timed-out`. */
function outcomesOf(plan: CheckPlan, input: RecordInput): ReadonlyMap<string, Outcome> {
  const keys = plan.checks.map((check) => `${check.kind}-${check.tool}`);
  const outcomes = new Map<string, Outcome>();
  const add = (key: string, outcome: Outcome): void => {
    if (!keys.includes(key)) {
      const planned = keys.length === 0 ? "the plan holds no check" : `planned: ${keys.join(", ")}`;
      throw invalid(`${key} names no planned check of ${plan.id}; ${planned}`, "record");
    }
    if (outcomes.has(key)) throw invalid(`${key} is given twice`, "record");
    outcomes.set(key, outcome);
  };
  for (const value of input.exits ?? []) {
    const match = EXIT.exec(value);
    const code = match === null ? Number.NaN : Number(match[2]);
    if (match === null || code > 255) {
      throw invalid(
        `--exit ${value} is not <kind>-<tool>=<code> with a code from 0 to 255`,
        "record",
      );
    }
    add(match[1] ?? "", { kind: "exit", code });
  }
  for (const key of input.timedOut ?? []) add(key, { kind: "timeout" });
  return outcomes;
}

export interface RecordOutcome {
  readonly result: RecordResult;
  /** The path of the result file, joined onto the run directory as given. */
  readonly file: string;
}

export function recordChecks(deps: CheckDeps, input: RecordInput): RecordOutcome {
  const { runDir, id } = input;
  checkId(id, "record");
  const round = roundOf(input.round);
  checkRunDir(deps, runDir);
  const plan = readPlan(deps, runDir, id);
  const outcomes = outcomesOf(plan, input);

  const checks: RecordResult["checks"] = plan.checks.map((planned) => {
    const outcome = outcomes.get(`${planned.kind}-${planned.tool}`) ?? { kind: "none" };
    const path = absolute(deps, planned.output);
    const written = deps.files.readText(path) ?? "";
    const text = bodyOf(written);
    if (outcome.kind !== "none" && !hasTrailer(written)) {
      deps.files.appendText(path, trailer(written, outcome, planned.timeout));
    }
    const status = statusOf(outcome);
    return {
      kind: planned.kind,
      tool: planned.tool,
      command: planned.command,
      cwd: plan.cwd,
      scoped: planned.scoped,
      status,
      exit: outcome.kind === "exit" ? outcome.code : null,
      timeout: planned.timeout,
      output: planned.output,
      tail: status === "pass" || status === "not-run" ? null : [...tailOf(text)],
    };
  });

  let findings: RecordResult["findings"] = null;
  if (round !== undefined) {
    const log = findingsLog(runDir, round);
    const ids = checks
      .filter((check) => check.status !== "pass")
      .map(
        (check) =>
          addFinding(deps.files, { log: absolute(deps, log), ...finding(check, check.output) }).id,
      );
    findings = { log, ids };
  }

  const result: RecordResult = {
    version: 3,
    id,
    at: plan.at,
    changed: plan.changed,
    scope: plan.scope,
    tests: plan.tests,
    verdict: verdictOf(checks.map((check) => check.status)),
    checks,
    skipped: plan.skipped,
    findings,
  };
  const file = resultPath(runDir, id);
  writeResult(deps.files, absolute(deps, file), result);
  return { result, file };
}
