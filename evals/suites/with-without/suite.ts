// The with / without suite (design D-9): every task of a task file runs in a
// `with` cell, whose plugin copy has the skill, and a `without` cell, whose
// copy lacks the skill directory; all else is equal. A plugin copy without the
// directory keeps a preloaded or model-invoked skill really absent.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
import type { CellSetup, SeriesIo, SeriesSetup } from "../../harness/runner.ts";
import { freshSeriesName } from "../../harness/series.ts";
import { ensureTools, evaluate, validateConfig } from "../../harness/tools.ts";
import { assertCommitted } from "../../harness/tree.ts";
import { withWithoutReport } from "./report.ts";
import { readTasks } from "./tasks.ts";
import type { WithWithoutTask } from "./tasks.ts";

const SUITE = "with-without";
/** The orchestrator of every session arm (design D-6). */
export const ORCHESTRATOR_MODEL = "claude-opus-5-5";
export const EXAMPLE_TASKS = fileURLToPath(
  new URL("./examples/craft/mermaid-drawer.yaml", import.meta.url),
);

type Fixture = "default" | "none";
type Cell = "with" | "without";
const CELL_NAMES: readonly Cell[] = ["with", "without"];

export class SkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillError";
  }
}

function frontmatterName(file: string): string | undefined {
  const text = readFileSync(file, "utf8");
  if (!text.startsWith("---\n")) return undefined;
  const end = text.indexOf("\n---", 4);
  return /^name:\s*(\S+)\s*$/m.exec(text.slice(0, end))?.[1];
}

function skillFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return skillFiles(path);
    return entry.name === "SKILL.md" ? [path] : [];
  });
}

/** The repository directory of each plugin a `--skill` may name (T42 craft D8). */
const PLUGIN_DIRS: Readonly<Record<string, string>> = {
  bdk: ".",
  "bdk-craft": "plugins/bdk-craft",
};

/** Where a skill lives: its plugin's directory in the repository and its directory under that plugin's `skills/`. */
export interface SkillLocation {
  readonly pluginDir: string;
  readonly path: string;
}

/**
 * The location of a skill named `bdk:<name>` or `bdk-craft:<name>`, found by
 * the `name` in its frontmatter, so a nested role skill resolves too.
 */
export function skillDir(skill: string, repoRoot = REPO_ROOT): SkillLocation {
  const [plugin, name, ...rest] = skill.split(":");
  const pluginDir = plugin === undefined ? undefined : PLUGIN_DIRS[plugin];
  if (pluginDir === undefined || name === undefined || name === "" || rest.length > 0) {
    throw new SkillError(`--skill names a skill as bdk:<name> or bdk-craft:<name>, got ${skill}`);
  }
  const skills = join(repoRoot, pluginDir, "skills");
  const file = skillFiles(skills).find((path) => frontmatterName(path) === name);
  if (file === undefined) {
    throw new SkillError(`no skill named ${name} under ${relative(repoRoot, skills)}/`);
  }
  return { pluginDir, path: relative(skills, join(file, "..")) };
}

interface CellBuild {
  readonly plugin: string;
  readonly bdkCommit: string;
  /** sha256 of the skill's SKILL.md in the `with` copy; null in `without`. */
  readonly variantHash: string | null;
}

export interface WithWithoutSpec {
  readonly skill: string;
  readonly series: string;
  /** The series' own directory under `evals/.runs/`. */
  readonly dir: string;
  /** The series' sandbox outside the repository: working copies and the config home. */
  readonly sandbox: string;
  readonly tasks: readonly WithWithoutTask[];
  readonly cells: Readonly<Record<Cell, CellBuild>>;
  /** The base every run copies: the prepared fixture, or an empty repository. */
  readonly base: string;
  readonly fixture: Fixture;
  readonly versions: Versions;
  readonly runs: number;
  readonly budgetUsd: number;
  readonly runCapUsd: number;
  readonly ledgerFile: string;
  readonly resultsFile: string;
}

/** The skill part of `<plugin>:<name>`, which prefixes the item ids so one results directory holds many skills. */
function skillSlug(skill: string): string {
  return skill.split(":")[1] ?? skill;
}

/** The series without I/O, over plugin copies and a base already built. */
export function describeWithWithout(spec: WithWithoutSpec): SeriesSetup {
  const configHome = join(spec.sandbox, "config-home");
  const cells = Object.fromEntries(
    CELL_NAMES.map((name): [string, CellSetup] => {
      const build = spec.cells[name];
      const workDir = join(spec.sandbox, "work", name);
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
            configHome,
            maxBudgetUsd: spec.runCapUsd,
          }),
          plan: {
            debugFile,
            expectedPlugins: 1,
            workDir,
            fixtureBase: spec.base,
            provenance: {
              fixtureCommit: spec.fixture === "default" ? spec.versions.fixture.commit : null,
              bdkCommit: build.bdkCommit,
              variantHash: build.variantHash,
            },
            settings: { skill: spec.skill },
          },
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
    description: `with / without ${spec.skill} ${spec.series}`,
    prompt: "{{bdk_prompt}}",
    cells,
    items: spec.tasks.map((task) => ({
      id: `${skillSlug(spec.skill)}/${task.id}`,
      vars: { bdk_prompt: task.prompt },
      ...(task.assert === undefined ? {} : { assert: task.assert }),
    })),
    runs: spec.runs,
  };
}

function buildCells(dir: string, skill: SkillLocation): Record<Cell, CellBuild> {
  const build = (cell: Cell): CellBuild => {
    const copy = buildPluginCopy({
      repoRoot: REPO_ROOT,
      ref: "HEAD",
      target: join(dir, "plugins", cell),
      ...(skill.pluginDir === "." ? {} : { pluginDir: skill.pluginDir }),
      ...(cell === "without" ? { withoutSkill: skill.path } : {}),
    });
    const skillFile = join(copy.dir, "skills", skill.path, "SKILL.md");
    return {
      plugin: copy.dir,
      bdkCommit: copy.commit,
      variantHash: cell === "with" ? sha256File(skillFile) : null,
    };
  };
  const cells = { with: build("with"), without: build("without") };
  if (existsSync(join(cells.without.plugin, "skills", skill.path))) {
    throw new Error(`the without copy still has skills/${skill.path}`);
  }
  return cells;
}

export function withWithoutRunner(io: Omit<SeriesIo, "evaluate">): SuiteRunner {
  return {
    async run(options: RunOptions): Promise<number> {
      const skill = options.skill ?? "";
      let location: SkillLocation;
      let tasks: WithWithoutTask[];
      try {
        location = skillDir(skill);
        tasks = readTasks(options.tasks ?? "");
      } catch (error) {
        io.printError(error instanceof Error ? error.message : String(error));
        return 2;
      }
      ensureTools(EVALS_DIR);
      assertCommitted();
      const versions = readVersions();
      const fixture = options.fixture ?? "default";
      const date = new Date().toISOString().slice(0, 10);
      const series = freshSeriesName(
        `${options.probe ? "probe" : "series"}-${skillSlug(skill)}-${date}`,
        (name) => readRows(resultsFile(SUITE, name)).length > 0,
      );
      const dir = join(RUNS_DIR, "series", SUITE, series);
      const sandbox = sandboxOf(SUITE, series);
      rmSync(dir, { recursive: true, force: true });
      rmSync(sandbox, { recursive: true, force: true });
      mkdirSync(join(sandbox, "config-home"), { recursive: true });
      const base =
        fixture === "default"
          ? prepareFixture(versions.fixture, join(RUNS_DIR, "cache"), {
              install: npmCi,
            })
          : emptyBase(join(sandbox, "empty-base"));
      const setup = describeWithWithout({
        skill,
        series,
        dir,
        sandbox,
        tasks,
        cells: buildCells(sandbox, location),
        base,
        fixture,
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
        skillDir("bdk-craft:mermaid-drawer");
        const placeholder = (cell: Cell): CellBuild => ({
          plugin: join(dir, "plugins", cell),
          bdkCommit: "0".repeat(40),
          variantHash: cell === "with" ? "0".repeat(64) : null,
        });
        const setup = describeWithWithout({
          skill: "bdk-craft:mermaid-drawer",
          series: "check",
          dir,
          sandbox: dir,
          tasks: readTasks(EXAMPLE_TASKS),
          cells: { with: placeholder("with"), without: placeholder("without") },
          base: join(dir, "base"),
          fixture: "none",
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
      const dir = join(EVALS_DIR, "results", SUITE);
      const lines = withWithoutReport(readSuiteRows(dir));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "report.md");
      writeFileSync(file, `${lines.join("\n")}\n`);
      io.print(`report: ${file}`);
      return Promise.resolve();
    },
  };
}
