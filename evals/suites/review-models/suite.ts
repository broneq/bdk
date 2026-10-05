// The review-models suite (design D10 of v3-t42-review-skills): `/bdk:cr` on
// one executed Change whose delivered code holds seeded defects, in three
// cells that differ only in the model of the `reviewer` adapter. A series
// builds one base and one plugin copy per cell; every run starts from a fresh
// copy of the base.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RunOptions, SuiteRunner } from "../../harness/cli.ts";
import { freshCopy, npmCi, prepareFixture } from "../../harness/fixture.ts";
import {
  EVALS_DIR,
  REPO_ROOT,
  RUNS_DIR,
  readVersions,
  resultsFile,
  sandboxOf,
} from "../../harness/paths.ts";
import type { Versions } from "../../harness/paths.ts";
import { buildPluginCopy } from "../../harness/plugins.ts";
import { sessionProvider } from "../../harness/providers.ts";
import { readRows, readSuiteRows } from "../../harness/results.ts";
import { probeSummary, renderSeries, runSeries } from "../../harness/runner.ts";
import type { CellSetup, SeriesIo, SeriesSetup } from "../../harness/runner.ts";
import { freshSeriesName, seriesStamp } from "../../harness/series.ts";
import { ensureTools, evaluate, validateConfig } from "../../harness/tools.ts";
import { assertCommitted } from "../../harness/tree.ts";
import type { KernelSettings } from "../stages/hooks.ts";
import { runSeed, seedPatches } from "../stages/seeds.ts";
import { keyProblems, patchedFiles, readKey, readPatch } from "./key.ts";
import type { AnswerKey } from "./key.ts";
import { reviewModelsReport } from "./report.ts";

const SUITE = "review-models";
const ORCHESTRATOR_MODEL = "claude-opus-5-5";
const ITEM = "review";
const PROMPT = "/bdk:cr";

/** The cells in run order and the `reviewer` model of each; `sonnet-prime` is the A/A pair. */
export const CELLS: Readonly<Record<string, string>> = {
  sonnet: "sonnet",
  "sonnet-prime": "sonnet",
  opus: "opus",
};

/** The project settings of the base: the gate runner's commands, and Lavish off. */
const SETTINGS: readonly (readonly [string, string])[] = [
  ["tools.test.vitest", "{tier: fast, command: npx vitest run}"],
  ["tools.lint.eslint", "{tier: lint, command: npx eslint .}"],
  ["features.lavish", "false"],
];

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(dir: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: dir, env: ENV, stdio: "pipe" });
}

/**
 * The fixture with the key's seed, its tasks delivering the defects with
 * their code, and the project settings committed: the review sees the
 * defects as the Change's committed code, with its evidence fresh.
 */
export function seedBase(base: string, kernel: KernelSettings, key: AnswerKey): void {
  runSeed(key.seed, base, kernel, readPatch(key));
  const env = { ...ENV, XDG_CONFIG_HOME: kernel.configHome };
  for (const [name, value] of SETTINGS) {
    execFileSync("node", [kernel.bundle, "config", "set", name, value, "--json"], {
      cwd: base,
      env,
      stdio: "pipe",
    });
  }
  git(base, "add", "-A");
  git(base, "commit", "-q", "-m", "chore(bdk): project settings");
}

/** What is wrong with the answer key against its patch and seed; checked without a model. */
export function checkKey(key: AnswerKey = readKey()): void {
  const tasks = seedPatches(key.seed).map((file) => readFileSync(file, "utf8"));
  const problems = keyProblems(key, readPatch(key), patchedFiles(tasks));
  if (problems.length > 0) throw new Error(`review-models answer key: ${problems.join("; ")}`);
}

interface CellBuild {
  readonly plugin: string;
  readonly bdkCommit: string;
  readonly variantHash: string | null;
}

interface SeriesSpec {
  readonly series: string;
  /** The series' own directory under `evals/.runs/`. */
  readonly dir: string;
  /** The series' sandbox outside the repository: working copies, the base and the config home. */
  readonly sandbox: string;
  readonly cells: Readonly<Record<string, CellBuild>>;
  readonly base: string;
  readonly versions: Versions;
  readonly runs: number;
  readonly runCapUsd: number;
  readonly resultsFile: string;
}

function configHome(sandbox: string): string {
  return join(sandbox, "config-home");
}

/** The series without I/O, over plugin copies and a base already built. */
export function describeSeries(spec: SeriesSpec): SeriesSetup {
  const cells = Object.fromEntries(
    Object.keys(CELLS).map((name): [string, CellSetup] => {
      const build = spec.cells[name];
      if (build === undefined) throw new Error(`no plugin copy for cell ${name}`);
      const workDir = join(spec.sandbox, "work", name);
      const debugFile = join(spec.dir, "debug", `${name}.log`);
      const settings: KernelSettings = {
        bundle: join(build.plugin, "dist", "bdk.mjs"),
        configHome: configHome(spec.sandbox),
      };
      return [
        name,
        {
          provider: sessionProvider({
            label: name,
            model: ORCHESTRATOR_MODEL,
            plugin: build.plugin,
            workDir,
            debugFile,
            configHome: configHome(spec.sandbox),
            maxBudgetUsd: spec.runCapUsd,
          }),
          plan: {
            debugFile,
            expectedPlugins: 1,
            workDir,
            fixtureBase: spec.base,
            provenance: {
              fixtureCommit: spec.versions.fixture.commit,
              bdkCommit: build.bdkCommit,
              variantHash: build.variantHash,
            },
            settings: { ...settings },
          },
        },
      ];
    }),
  );
  return {
    plan: {
      suite: SUITE,
      series: spec.series,
      runCapUsd: spec.runCapUsd,
      resultsFile: spec.resultsFile,
      rawDir: join(spec.dir, "raw"),
    },
    description: `review models ${spec.series}`,
    // promptfoo reads a bare prompt starting with `/` as a file path.
    prompt: "{{bdk_prompt}}",
    cells,
    items: [{ id: ITEM, vars: { bdk_prompt: PROMPT } }],
    runs: spec.runs,
  };
}

function buildCells(sandbox: string): Record<string, CellBuild> {
  return Object.fromEntries(
    Object.entries(CELLS).map(([name, model]) => {
      const copy = buildPluginCopy({
        repoRoot: REPO_ROOT,
        ref: "HEAD",
        target: join(sandbox, "plugins", name),
        agentModel: { agent: "reviewer", model },
      });
      return [name, { plugin: copy.dir, bdkCommit: copy.commit, variantHash: copy.variantHash }];
    }),
  );
}

export function reviewModelsRunner(io: Omit<SeriesIo, "evaluate">): SuiteRunner {
  return {
    async run(options: RunOptions): Promise<number> {
      ensureTools(EVALS_DIR);
      assertCommitted();
      const key = readKey();
      checkKey(key);
      const versions = readVersions();
      const stamp = seriesStamp();
      const series = freshSeriesName(
        `${options.probe ? "probe" : "series"}-${stamp}`,
        (name) => readRows(resultsFile(SUITE, name)).length > 0,
      );
      const dir = join(RUNS_DIR, "series", SUITE, series);
      const sandbox = sandboxOf(SUITE, series);
      rmSync(dir, { recursive: true, force: true });
      rmSync(sandbox, { recursive: true, force: true });
      mkdirSync(configHome(sandbox), { recursive: true });
      const cells = buildCells(sandbox);
      const base = join(sandbox, "base");
      freshCopy(
        prepareFixture(versions.fixture, join(RUNS_DIR, "cache"), { install: npmCi }),
        base,
      );
      const first = Object.values(cells)[0];
      if (first === undefined) throw new Error("review-models has no cell");
      seedBase(
        base,
        { bundle: join(first.plugin, "dist", "bdk.mjs"), configHome: configHome(sandbox) },
        key,
      );
      const setup = describeSeries({
        series,
        dir,
        sandbox,
        cells,
        base,
        versions,
        runs: options.probe ? 1 : options.runs,
        runCapUsd: options.runCap,
        resultsFile: resultsFile(SUITE, series),
      });
      const code = await runSeries(setup, renderSeries(setup, dir), {
        ...io,
        evaluate: (config, output, env) => evaluate(EVALS_DIR, config, output, env),
      });
      if (options.probe) {
        const lines = probeSummary(readRows(resultsFile(SUITE, series)), options.runs);
        for (const line of lines) io.print(line);
      }
      return code;
    },

    check(): Promise<void> {
      ensureTools(EVALS_DIR);
      checkKey();
      const dir = mkdtempSync(join(tmpdir(), "bdk-evals-check-"));
      try {
        const placeholder: CellBuild = {
          plugin: join(dir, "plugin"),
          bdkCommit: "0".repeat(40),
          variantHash: "0".repeat(64),
        };
        const setup = describeSeries({
          series: "check",
          dir,
          sandbox: dir,
          cells: Object.fromEntries(Object.keys(CELLS).map((name) => [name, placeholder])),
          base: join(dir, "base"),
          versions: readVersions(),
          runs: 5,
          runCapUsd: 15,
          resultsFile: join(dir, "rows.jsonl"),
        });
        validateConfig(EVALS_DIR, renderSeries(setup, dir).configFile);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return Promise.resolve();
    },

    report(): Promise<void> {
      const dir = join(EVALS_DIR, "results", SUITE);
      const lines = reviewModelsReport(readSuiteRows(dir));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "report.md");
      writeFileSync(file, `${lines.join("\n")}\n`);
      io.print(`report: ${file}`);
      return Promise.resolve();
    },
  };
}
