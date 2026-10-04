// The stages suite's run hooks (design D-8 of v3-t41-setup-change). Before a
// run: the case's preparation in the fresh working copy, and the project
// settings that answer `AskUserQuestion`. After it: the case's expectations
// against the kernel state the session left, plus turns, wall time and the
// number of questions asked and of kernel refusals met.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { freshCopy } from "../../harness/fixture.ts";
import { rawDirOf } from "../../harness/hook.ts";
import type { EvalResult, Measurement, RunContext, SuiteHooks } from "../../harness/hook.ts";
import { answerHookSettings } from "./answer.ts";
import type { StageCase } from "./cases.ts";
import { checkExpectations } from "./checks.ts";
import { countRefusals, refusalMetrics } from "./refusals.ts";
import { runSeed } from "./seeds.ts";
import type { CheckResult, KernelCall } from "./checks.ts";

const ANSWER_HOOK = fileURLToPath(new URL("./answer-hook.ts", import.meta.url));

/** The var that carries the case to the hooks, as JSON. */
export const CASE_VAR = "bdk_case";

export interface StageCellSettings {
  /** The plugin copy's kernel bundle, `$BDK` in a case's preparation. */
  readonly bundle: string;
  /** The session's `XDG_CONFIG_HOME`, so preparation and checks read the same global layer. */
  readonly configHome: string;
  /** The empty repository a case with `base: empty` starts from. */
  readonly emptyBase: string;
}

/** What a kernel call in a working copy needs of the cell's settings. */
export type KernelSettings = Pick<StageCellSettings, "bundle" | "configHome">;

function environment(settings: KernelSettings): NodeJS.ProcessEnv {
  return {
    ...process.env,
    BDK: settings.bundle,
    XDG_CONFIG_HOME: settings.configHome,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
}

/**
 * Installs the answer hook and runs the case's seed and preparation in
 * `workDir`, which the harness has reset to the fixture; a case on the empty
 * base replaces it.
 * The settings file is excluded from git, so the skill sees the base's own state.
 */
export function prepareRun(workDir: string, stage: StageCase, settings: StageCellSettings): void {
  if (stage.base === "empty") freshCopy(settings.emptyBase, workDir);
  const answers = join(dirname(workDir), `answers-${stage.id}.json`);
  writeFileSync(answers, `${JSON.stringify(stage.answers)}\n`);
  mkdirSync(join(workDir, ".claude"), { recursive: true });
  writeFileSync(
    join(workDir, ".claude", "settings.json"),
    `${JSON.stringify(answerHookSettings(ANSWER_HOOK, answers), null, 2)}\n`,
  );
  appendFileSync(join(workDir, ".git", "info", "exclude"), "\n/.claude/settings.json\n");
  if (stage.seed !== undefined) {
    runSeed(stage.seed, workDir, { bundle: settings.bundle, configHome: settings.configHome });
  }
  for (const command of stage.prepare) {
    execFileSync("sh", ["-c", command], {
      cwd: workDir,
      env: environment(settings),
      stdio: "pipe",
    });
  }
}

/** One kernel command with `--json` in the run's working copy. */
export function kernelIn(workDir: string, settings: KernelSettings) {
  return (args: string): KernelCall => {
    const result = spawnSync(
      process.execPath,
      [settings.bundle, ...args.split(/\s+/).filter(Boolean), "--json"],
      { cwd: workDir, env: environment(settings), encoding: "utf8" },
    );
    let json: unknown;
    try {
      json = JSON.parse(result.stdout) as unknown;
    } catch {
      json = undefined;
    }
    return { code: result.status ?? -1, json };
  };
}

function caseOf(context: RunContext): StageCase {
  const text = context.vars[CASE_VAR];
  if (text === undefined) throw new Error(`the test carries no ${CASE_VAR} var`);
  return JSON.parse(text) as StageCase;
}

function settingsOf(context: RunContext): StageCellSettings {
  return context.cell.settings as unknown as StageCellSettings;
}

export function measure(result: EvalResult, checks: CheckResult): Measurement {
  const calls = result.response?.metadata?.toolCalls ?? [];
  return {
    metrics: {
      expect_pass: checks.pass ? 1 : 0,
      questions: calls.filter((call) => call.name === "AskUserQuestion").length,
      turns: result.response?.metadata?.numTurns ?? null,
      wall_s: result.latencyMs === undefined ? null : result.latencyMs / 1000,
      ...refusalMetrics(countRefusals(calls)),
    },
    extraCost: 0,
    templateHashes: [],
  };
}

export const hooks: SuiteHooks = {
  beforeRun: (context) => {
    if (context.cell.workDir === null) throw new Error("a stages run needs a working copy");
    prepareRun(context.cell.workDir, caseOf(context), settingsOf(context));
  },
  measure: (context, result) => {
    if (context.cell.workDir === null) throw new Error("a stages run needs a working copy");
    const stage = caseOf(context);
    const output = result.response?.output;
    const checks = checkExpectations(
      stage.expect,
      kernelIn(context.cell.workDir, settingsOf(context)),
      typeof output === "string" ? output : JSON.stringify(output ?? ""),
    );
    const dir = rawDirOf(context);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "checks.json"), `${JSON.stringify(checks, null, 2)}\n`);
    return Promise.resolve(measure(result, checks));
  },
};
