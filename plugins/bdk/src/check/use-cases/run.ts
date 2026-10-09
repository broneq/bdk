// `bdk check run` (spec `bdk-cli/check`): runs the configured check commands one after another,
// writes each output and the result file, and appends red checks to a round's findings log.

import { resolve } from "node:path";

import { loadConfig } from "../../config/index.ts";
import type { ConfigDeps } from "../../config/index.ts";
import { addFinding } from "../../findings/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import type { Shell } from "../../shared/shell/index.ts";
import { KINDS, planChecks, scopeOf } from "../domain/plan.ts";
import type { Kind, Tools } from "../domain/plan.ts";
import { finding, statusOf, tailOf, trailer, verdictOf } from "../domain/verdict.ts";
import type { RunResult } from "../schema/run.ts";
import { findingsLog, isDirectory, outputPath, resultPath, writeResult } from "../store/results.ts";

/** What the check slice needs from the OS; `main.ts` passes it in. */
export interface CheckDeps extends ConfigDeps {
  readonly shell: Shell;
}

export interface RunInput {
  readonly runDir: string;
  readonly id: string;
  readonly scope?: readonly string[] | undefined;
  readonly kinds?: readonly string[] | undefined;
  readonly round?: string | undefined;
}

const KEBAB = /^[a-z0-9][a-z0-9-]*$/;
const HINT = "Run bdk check run --help.";

function invalid(message: string): CliError {
  return new CliError("usage/invalid-argument", message, HINT);
}

function kindsOf(values: readonly string[] | undefined): readonly Kind[] | undefined {
  if (values === undefined || values.length === 0) return undefined;
  return values.map((value) => {
    const kind = KINDS.find((known) => known === value);
    if (kind === undefined) throw invalid(`--kind ${value} is not a kind; use test, lint or build`);
    return kind;
  });
}

function roundOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw invalid(`--round must be a positive integer, not ${value}`);
  }
  return Number(value);
}

function toolsOf(deps: ConfigDeps): { readonly root: string; readonly tools: Tools } {
  const config = loadConfig(deps);
  if (config.status === "not-configured") {
    throw new CliError(
      "env/not-configured",
      `BDK is not configured in ${config.root}: missing ${config.missing.join(" and ")}`,
      "Run /bdk:setup.",
    );
  }
  if (config.status === "invalid") {
    const [first] = config.problems;
    throw new CliError(
      "env/config-invalid",
      `the BDK configuration is invalid${first === undefined ? "" : `: ${first.key}: ${first.message} (${first.file})`}`,
      "Run bdk config check.",
    );
  }
  const { test, lint, build } = config.settings.tools;
  return { root: config.root, tools: { test, lint, build } };
}

export interface RunOutcome {
  readonly result: RunResult;
  /** The path of the result file, joined onto the run directory as given. */
  readonly file: string;
}

export async function runChecks(deps: CheckDeps, input: RunInput): Promise<RunOutcome> {
  const { runDir, id } = input;
  if (!KEBAB.test(id)) throw invalid(`<id> must be kebab-case (a-z, 0-9, -), not ${id}`);
  const kinds = kindsOf(input.kinds);
  const round = roundOf(input.round);
  if (input.scope?.includes("") === true) throw invalid("--scope takes a path, not an empty value");
  const at = (path: string): string => resolve(deps.cwd, path);
  if (!isDirectory(deps.files, at(runDir))) {
    throw new CliError(
      "env/run-dir-missing",
      `run directory ${runDir} does not exist`,
      "Pass the run directory of the Change, such as .bdk/runs/<change>.",
    );
  }
  const { root, tools } = toolsOf(deps);
  const scope = scopeOf(input.scope);

  const plan = planChecks(tools, kinds, scope);
  const checks: RunResult["checks"] = [];
  for (const planned of plan.checks) {
    const output = outputPath(runDir, id, planned.kind, planned.tool);
    const outcome = await deps.shell(planned.command, {
      cwd: root,
      output: at(output),
      timeout: planned.timeout,
    });
    const text = deps.files.readText(at(output)) ?? "";
    deps.files.appendText(at(output), trailer(text, outcome, planned.timeout));
    const status = statusOf(outcome);
    checks.push({
      kind: planned.kind,
      tool: planned.tool,
      command: planned.command,
      scoped: planned.scoped,
      status,
      exit: outcome.kind === "exit" ? outcome.code : null,
      timeout: planned.timeout,
      output,
      tail: status === "pass" ? null : [...tailOf(text)],
    });
  }

  let findings: RunResult["findings"] = null;
  if (round !== undefined) {
    const log = findingsLog(runDir, round);
    const ids = checks
      .filter((check) => check.status !== "pass")
      .map((check) => addFinding(deps.files, { log: at(log), ...finding(check, check.output) }).id);
    findings = { log, ids };
  }

  const result: RunResult = {
    version: 1,
    id,
    scope: scope === null ? null : [...scope],
    verdict: verdictOf(checks.map((check) => check.status)),
    checks,
    skipped: [...plan.skipped],
    findings,
  };
  const file = resultPath(runDir, id);
  writeResult(deps.files, at(file), result);
  return { result, file };
}
