// The stages suite (design D-8 of v3-t41-setup-change): the cases of one
// user-only stage skill, each typed as its slash command in a fresh copy of
// its base with BDK's plugin copy loaded, and checked against the kernel state
// the run leaves. One cell: the suite measures whether the skill works, not a
// difference between variants.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readLedger, spent } from "../../harness/budget.ts";
import type { RunOptions, SuiteRunner } from "../../harness/cli.ts";
import { emptyBase, npmCi, prepareFixture } from "../../harness/fixture.ts";
import {
  EVALS_DIR,
  LEDGER_FILE,
  REPO_ROOT,
  RUNS_DIR,
  readVersions,
  resultsFile,
  sandboxOf,
} from "../../harness/paths.ts";
import type { Versions } from "../../harness/paths.ts";
import { buildPluginCopy, sha256File } from "../../harness/plugins.ts";
import { sessionProvider } from "../../harness/providers.ts";
import { readRows, readSuiteRows } from "../../harness/results.ts";
import { probeSummary, renderSeries, runSeries } from "../../harness/runner.ts";
import type { SeriesIo, SeriesSetup } from "../../harness/runner.ts";
import { freshSeriesName } from "../../harness/series.ts";
import { ensureTools, evaluate, validateConfig } from "../../harness/tools.ts";
import { assertCommitted } from "../../harness/tree.ts";
import { caseFile, readCases } from "./cases.ts";
import type { StageCase } from "./cases.ts";
import { CASE_VAR } from "./hooks.ts";
import type { StageCellSettings } from "./hooks.ts";
import { stagesReport } from "./report.ts";

const SUITE = "stages";
const CELL = "bdk";
/** The orchestrator of every session, as in the other session suites. */
const ORCHESTRATOR_MODEL = "claude-opus-5-5";
/** The stage skills with a case file. */
const STAGE_SKILLS = ["setup", "change"] as const;

class StageSkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StageSkillError";
  }
}

/** The skill part of `--skill`, which takes `setup` or `bdk:setup`. */
export function stageSkill(value: string | undefined): string {
  const name = value?.replace(/^bdk:/, "") ?? "";
  if (!(STAGE_SKILLS as readonly string[]).includes(name)) {
    throw new StageSkillError(
      `--skill names a stage skill with a case file (${STAGE_SKILLS.join(", ")}), got ${value ?? "nothing"}`,
    );
  }
  return name;
}

export interface StagesSpec {
  readonly skill: string;
  readonly series: string;
  /** The series' own directory under `evals/.runs/`. */
  readonly dir: string;
  /** The series' sandbox outside the repository: working copy, bases and the config home. */
  readonly sandbox: string;
  readonly cases: readonly StageCase[];
  readonly plugin: string;
  readonly bdkCommit: string;
  /** The prepared fixture base. */
  readonly fixtureBase: string;
  /** The empty repository a case with `base: empty` starts from. */
  readonly emptyBase: string;
  readonly versions: Versions;
  readonly runs: number;
  readonly budgetUsd: number;
  readonly runCapUsd: number;
  readonly ledgerFile: string;
  readonly resultsFile: string;
}

/** The series without I/O, over a plugin copy and bases already built. */
export function describeStages(spec: StagesSpec): SeriesSetup {
  const configHome = join(spec.sandbox, "config-home");
  const workDir = join(spec.sandbox, "work", CELL);
  const debugFile = join(spec.dir, "debug", `${CELL}.log`);
  const settings: StageCellSettings = {
    bundle: join(spec.plugin, "dist", "bdk.mjs"),
    configHome,
    emptyBase: spec.emptyBase,
  };
  return {
    plan: {
      suite: SUITE,
      series: spec.series,
      ledgerFile: spec.ledgerFile,
      budgetUsd: spec.budgetUsd,
      runCapUsd: spec.runCapUsd,
      resultsFile: spec.resultsFile,
      rawDir: join(spec.dir, "raw"),
    },
    description: `stages ${spec.skill} ${spec.series}`,
    prompt: "{{bdk_prompt}}",
    cells: {
      [CELL]: {
        provider: sessionProvider({
          label: CELL,
          model: ORCHESTRATOR_MODEL,
          plugin: spec.plugin,
          workDir,
          debugFile,
          configHome,
          maxBudgetUsd: spec.runCapUsd,
          askUserQuestion: true,
        }),
        plan: {
          debugFile,
          expectedPlugins: 1,
          workDir,
          fixtureBase: spec.fixtureBase,
          provenance: {
            fixtureCommit: spec.versions.fixture.commit,
            bdkCommit: spec.bdkCommit,
            variantHash: sha256File(join(spec.plugin, "skills", "stages", spec.skill, "SKILL.md")),
          },
          settings: { ...settings },
        },
      },
    },
    items: spec.cases.map((stage) => ({
      id: `${spec.skill}/${stage.id}`,
      vars: { bdk_prompt: stage.command, [CASE_VAR]: JSON.stringify(stage) },
    })),
    runs: spec.runs,
  };
}

export function stagesRunner(io: Omit<SeriesIo, "evaluate">): SuiteRunner {
  return {
    async run(options: RunOptions): Promise<number> {
      let skill: string;
      let cases: StageCase[];
      try {
        skill = stageSkill(options.skill);
        cases = readCases(caseFile(skill));
      } catch (error) {
        io.printError(error instanceof Error ? error.message : String(error));
        return 2;
      }
      ensureTools(EVALS_DIR);
      assertCommitted();
      const versions = readVersions();
      const date = new Date().toISOString().slice(0, 10);
      const series = freshSeriesName(
        `${options.probe ? "probe" : "series"}-${skill}-${date}`,
        (name) => readRows(resultsFile(SUITE, name)).length > 0,
      );
      const dir = join(RUNS_DIR, "series", SUITE, series);
      const sandbox = sandboxOf(SUITE, series);
      rmSync(dir, { recursive: true, force: true });
      rmSync(sandbox, { recursive: true, force: true });
      mkdirSync(join(sandbox, "config-home"), { recursive: true });
      const copy = buildPluginCopy({
        repoRoot: REPO_ROOT,
        ref: "HEAD",
        target: join(sandbox, "plugins", CELL),
      });
      const setup = describeStages({
        skill,
        series,
        dir,
        sandbox,
        cases,
        plugin: copy.dir,
        bdkCommit: copy.commit,
        fixtureBase: prepareFixture(versions.fixture, join(RUNS_DIR, "cache"), { install: npmCi }),
        emptyBase: emptyBase(join(sandbox, "empty-base")),
        versions,
        runs: options.probe ? 1 : options.runs,
        budgetUsd: options.budget,
        runCapUsd: options.runCap,
        ledgerFile: LEDGER_FILE,
        resultsFile: resultsFile(SUITE, series),
      });
      const code = await runSeries(setup, renderSeries(setup, dir), {
        ...io,
        evaluate: (config, output, env) => evaluate(EVALS_DIR, config, output, env),
      });
      if (options.probe) {
        const lines = probeSummary(
          readRows(resultsFile(SUITE, series)),
          options.runs,
          options.budget,
          spent(readLedger(LEDGER_FILE)),
        );
        for (const line of lines) io.print(line);
      }
      return code;
    },

    check(): Promise<void> {
      ensureTools(EVALS_DIR);
      const dir = mkdtempSync(join(tmpdir(), "bdk-evals-check-"));
      try {
        // The variant hash reads the skill from the plugin copy; the
        // repository stands in for it here.
        for (const skill of STAGE_SKILLS) {
          const setup = describeStages({
            skill,
            series: "check",
            dir: join(dir, skill),
            sandbox: join(dir, skill),
            cases: readCases(caseFile(skill)),
            plugin: REPO_ROOT,
            bdkCommit: "0".repeat(40),
            fixtureBase: join(dir, "fixture"),
            emptyBase: join(dir, "empty"),
            versions: readVersions(),
            runs: 5,
            budgetUsd: 100,
            runCapUsd: 15,
            ledgerFile: join(dir, "budget.json"),
            resultsFile: join(dir, "rows.jsonl"),
          });
          validateConfig(EVALS_DIR, renderSeries(setup, join(dir, skill)).configFile);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return Promise.resolve();
    },

    report(): Promise<void> {
      const dir = join(EVALS_DIR, "results", SUITE);
      const lines = stagesReport(readSuiteRows(dir));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "report.md");
      writeFileSync(file, `${lines.join("\n")}\n`);
      io.print(`report: ${file}`);
      return Promise.resolve();
    },
  };
}
