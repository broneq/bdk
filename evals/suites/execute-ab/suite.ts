// The execute A/B suite (design D-4, D-5, D-7): one fixture task executed by
// three arms. A series builds each arm's plugin copy and seeded base once,
// then every run starts from a fresh copy of its arm's base.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readLedger, spent } from "../../harness/budget.ts";
import type { RunOptions, SuiteRunner } from "../../harness/cli.ts";
import { freshCopy, npmCi, prepareFixture } from "../../harness/fixture.ts";
import {
  EVALS_DIR,
  LEDGER_FILE,
  REPO_ROOT,
  RUNS_DIR,
  readVersions,
  resultsFile,
} from "../../harness/paths.ts";
import type { Versions } from "../../harness/paths.ts";
import { buildPluginCopy } from "../../harness/plugins.ts";
import { sessionProvider } from "../../harness/providers.ts";
import { readRows, readSuiteRows } from "../../harness/results.ts";
import { probeSummary, renderSeries, runSeries } from "../../harness/runner.ts";
import type { CellSetup, SeriesIo, SeriesSetup } from "../../harness/runner.ts";
import { freshSeriesName } from "../../harness/series.ts";
import { ensureTools, evaluate, validateConfig } from "../../harness/tools.ts";
import { assertCommitted } from "../../harness/tree.ts";
import { executeReport } from "./report.ts";
import { TASK_DIR, V2_PLAN, readTask, seedV2, seedV3 } from "./seed.ts";

const SUITE = "execute-ab";
const ORCHESTRATOR_MODEL = "claude-opus-5-5";
const ITEM = "audit-csv";

export type Arm = "v2" | "v3-long" | "v3-thin";
const ARMS: readonly Arm[] = ["v2", "v3-long", "v3-thin"];

/** The cells in run order; `v3-long-prime` repeats `v3-long` as the A/A pair (design D-7). */
const CELLS: Readonly<Record<string, Arm>> = {
  v2: "v2",
  "v3-long": "v3-long",
  "v3-long-prime": "v3-long",
  "v3-thin": "v3-thin",
};

/** What the user types in each arm (design D-4). */
const PROMPTS: Readonly<Record<Arm, string>> = {
  v2: `/bdk:subagent-execute-plan ${V2_PLAN}`,
  "v3-long": "/bdk:execute",
  "v3-thin": "/bdk:execute",
};

const SUITE_DIR = fileURLToPath(new URL(".", import.meta.url));
const VARIANTS: Readonly<Record<Exclude<Arm, "v2">, string>> = {
  "v3-long": join(SUITE_DIR, "variants/execute-long/SKILL.md"),
  "v3-thin": join(SUITE_DIR, "variants/execute-thin/SKILL.md"),
};

/** A v3 copy keeps the role skills, the swarm skill and the role adapters (design D-5 "As built"). */
const V3_SKILLS = ["roles", "swarm"];
const V3_AGENTS = ["worker", "reader", "reviewer", "runner", "scout"];

interface ArmBuild {
  readonly plugin: string;
  readonly bdkCommit: string;
  readonly variantHash: string | null;
  /** The fixture base with the arm's seed committed; every run copies it. */
  readonly base: string;
}

interface SeriesSpec {
  readonly series: string;
  /** The series' own directory under `evals/.runs/`. */
  readonly dir: string;
  readonly arms: Readonly<Record<Arm, ArmBuild>>;
  readonly versions: Versions;
  readonly runs: number;
  readonly budgetUsd: number;
  readonly runCapUsd: number;
  readonly ledgerFile: string;
  readonly resultsFile: string;
}

/** An empty `XDG_CONFIG_HOME` shared by the seeds and the sessions of a series. */
function configHome(dir: string): string {
  return join(dir, "config-home");
}

/** The series without I/O, over plugin copies and bases already built. */
function describeSeries(spec: SeriesSpec): SeriesSetup {
  const cells = Object.fromEntries(
    Object.entries(CELLS).map(([name, arm]): [string, CellSetup] => {
      const build = spec.arms[arm];
      const workDir = join(spec.dir, "work", name);
      const debugFile = join(spec.dir, "debug", `${name}.log`);
      return [
        name,
        {
          provider: sessionProvider({
            label: name,
            model: ORCHESTRATOR_MODEL,
            plugin: build.plugin,
            workDir,
            debugFile,
            configHome: configHome(spec.dir),
            maxBudgetUsd: spec.runCapUsd,
          }),
          plan: {
            debugFile,
            expectedPlugins: 1,
            workDir,
            fixtureBase: build.base,
            provenance: {
              fixtureCommit: spec.versions.fixture.commit,
              bdkCommit: build.bdkCommit,
              variantHash: build.variantHash,
            },
            settings: { arm },
          },
          vars: { bdk_prompt: PROMPTS[arm] },
        },
      ];
    }),
  );
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
    description: `execute A/B ${spec.series}`,
    prompt: "{{bdk_prompt}}",
    cells,
    items: [{ id: ITEM, vars: {} }],
    runs: spec.runs,
  };
}

function buildArms(dir: string, versions: Versions): Record<Arm, ArmBuild> {
  const fixtureBase = prepareFixture(versions.fixture, join(RUNS_DIR, "cache"), {
    install: npmCi,
  });
  mkdirSync(configHome(dir), { recursive: true });
  const task = readTask(TASK_DIR);
  const build = (arm: Arm): ArmBuild => {
    const plugin = buildPluginCopy(
      arm === "v2"
        ? { repoRoot: REPO_ROOT, ref: versions.v2Tag, target: join(dir, "plugins", arm) }
        : {
            repoRoot: REPO_ROOT,
            ref: "HEAD",
            target: join(dir, "plugins", arm),
            keepSkills: V3_SKILLS,
            keepAgents: V3_AGENTS,
            variant: { name: "execute", file: VARIANTS[arm] },
          },
    );
    const base = join(dir, "bases", arm);
    freshCopy(fixtureBase, base);
    if (arm === "v2") seedV2(base, task);
    else
      seedV3(base, task, { bundle: join(plugin.dir, "dist/bdk.mjs"), configHome: configHome(dir) });
    return { plugin: plugin.dir, bdkCommit: plugin.commit, variantHash: plugin.variantHash, base };
  };
  return Object.fromEntries(ARMS.map((arm) => [arm, build(arm)])) as Record<Arm, ArmBuild>;
}

export function executeAbRunner(io: Omit<SeriesIo, "evaluate">): SuiteRunner {
  return {
    async run(options: RunOptions): Promise<number> {
      ensureTools(EVALS_DIR);
      assertCommitted();
      const versions = readVersions();
      const date = new Date().toISOString().slice(0, 10);
      const series = freshSeriesName(
        `${options.probe ? "probe" : "series"}-${date}`,
        (name) => readRows(resultsFile(SUITE, name)).length > 0,
      );
      const dir = join(RUNS_DIR, "series", SUITE, series);
      rmSync(dir, { recursive: true, force: true });
      const runs = options.probe ? 1 : options.runs;
      const setup = describeSeries({
        series,
        dir,
        arms: buildArms(dir, versions),
        versions,
        runs,
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
        const placeholder = (arm: Arm): ArmBuild => ({
          plugin: join(dir, "plugins", arm),
          bdkCommit: "0".repeat(40),
          variantHash: arm === "v2" ? null : "0".repeat(64),
          base: join(dir, "bases", arm),
        });
        const setup = describeSeries({
          series: "check",
          dir,
          arms: Object.fromEntries(ARMS.map((arm) => [arm, placeholder(arm)])) as Record<
            Arm,
            ArmBuild
          >,
          versions: readVersions(),
          runs: 5,
          budgetUsd: 100,
          runCapUsd: 15,
          ledgerFile: join(dir, "budget.json"),
          resultsFile: join(dir, "rows.jsonl"),
        });
        validateConfig(EVALS_DIR, renderSeries(setup, dir).configFile);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return Promise.resolve();
    },

    report(): Promise<void> {
      const file = join(EVALS_DIR, "results", SUITE, "report.md");
      const lines = executeReport(readSuiteRows(join(EVALS_DIR, "results", SUITE)));
      writeFileSync(file, `${lines.join("\n")}\n`);
      io.print(`report: ${file}`);
      return Promise.resolve();
    },
  };
}
