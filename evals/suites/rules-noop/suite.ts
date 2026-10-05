// The rules no-op suite (design D-8): two series of one-turn calls. M1 asks
// every rule bullet's question blind of Haiku 4.5 and of Sonnet 5 (twice, the
// A/A pair); M2 has the reviewer review every seeded patch with the rules,
// with them again (A/A) and without them. `pnpm eval rules-noop` runs M1, then M2.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readLedger, spent } from "../../harness/budget.ts";
import { UsageError } from "../../harness/cli.ts";
import type { RunOptions, SuiteRunner } from "../../harness/cli.ts";
import {
  EVALS_DIR,
  LEDGER_FILE,
  RUNS_DIR,
  readVersions,
  resultsFile,
} from "../../harness/paths.ts";
import type { Versions } from "../../harness/paths.ts";
import { oneTurnProvider } from "../../harness/providers.ts";
import { readRows, readSuiteRows } from "../../harness/results.ts";
import { probeSummary, renderSeries, runSeries } from "../../harness/runner.ts";
import type { CellSetup, SeriesIo, SeriesSetup } from "../../harness/runner.ts";
import { freshSeriesName, seriesStamp } from "../../harness/series.ts";
import type { EvalItem } from "../../harness/series.ts";
import { ensureTools, evaluate, validateConfig } from "../../harness/tools.ts";
import { assertCommitted, headCommit } from "../../harness/tree.ts";
import { readBullets } from "./bullets.ts";
import type { MeasurementKind } from "./hooks.ts";
import { readPatch, readViolations } from "./patches.ts";
import { M1_PROMPT, M1_SYSTEM, M2_PROMPT, reviewerSystem } from "./prompts.ts";
import { readQuestions } from "./questions.ts";
import { M1_CELLS, M2_CELLS, rulesReport } from "./table.ts";

const SUITE = "rules-noop";
export const HAIKU = "claude-haiku-4-5-20251001";
export const SONNET = "claude-sonnet-5";
/** The reviewer adapter runs on Sonnet (`agents/reviewer.md`). */
const REVIEWER_MODEL = SONNET;

/** One call's cap: a one-turn answer costs cents; a runaway reply cannot spend more. */
const ONE_TURN_CAP_USD = 1;

const M1_MODELS: Readonly<Record<(typeof M1_CELLS)[number], string>> = {
  haiku: HAIKU,
  sonnet: SONNET,
  "sonnet-prime": SONNET,
};
const M2_WITH_RULES: Readonly<Record<(typeof M2_CELLS)[number], boolean>> = {
  with: true,
  "with-prime": true,
  without: false,
};

/** How many items a probe runs: enough to spread over the rule files and include a clean control. */
const PROBE_ITEMS: Readonly<Record<MeasurementKind, number>> = { m1: 6, m2: 3 };

export interface MeasurementSpec {
  readonly kind: MeasurementKind;
  readonly series: string;
  /** The series' own directory under `evals/.runs/`. */
  readonly dir: string;
  readonly items: readonly EvalItem[];
  readonly bdkCommit: string;
  readonly versions: Versions;
  readonly runs: number;
  readonly budgetUsd: number;
  readonly runCapUsd: number;
  readonly ledgerFile: string;
  readonly resultsFile: string;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** The questions of the bullets still in the pack; a removed bullet has no text to judge against. */
export function m1Items(): EvalItem[] {
  const inPack = new Set(readBullets().map((bullet) => bullet.id));
  return readQuestions()
    .filter((entry) => inPack.has(entry.bullet))
    .map((entry) => ({ id: entry.bullet, vars: { question: entry.question } }));
}

/** Seeded patches first, then the clean controls, so a probe's last item is always a control. */
export function m2Items(): EvalItem[] {
  const patches = readViolations().patches;
  return [
    ...patches.filter((entry) => entry.violations.length > 0),
    ...patches.filter((entry) => entry.violations.length === 0),
  ].map(({ patch }) => ({ id: patch, vars: { diff: readPatch(patch) } }));
}

/**
 * A measurement's items: all of them, or with a patch filter only those M2
 * patches (in list order) and null for M1, which the filter skips.
 */
export function measurementItems(
  kind: MeasurementKind,
  patches: readonly string[] | undefined,
): EvalItem[] | null {
  if (patches === undefined) return allItems(kind);
  if (kind === "m1") return null;
  const items = m2Items();
  const unknown = patches.filter((name) => !items.some((item) => item.id === name));
  if (unknown.length > 0) throw new UsageError(`unknown patch ${unknown.join(", ")}`);
  return items.filter((item) => patches.includes(item.id)).sort((a, b) => a.id.localeCompare(b.id));
}

/** Items spread evenly over the list; for M2 the last item, a clean control, is always one of them. */
export function probeItems(items: readonly EvalItem[], count: number): EvalItem[] {
  if (items.length <= count) return [...items];
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => items[Math.round(index * step)]).filter(
    (item): item is EvalItem => item !== undefined,
  );
}

/** One measurement's series without I/O. */
export function describeMeasurement(spec: MeasurementSpec): SeriesSetup {
  const workDir = join(spec.dir, "empty");
  const cellNames: readonly string[] = spec.kind === "m1" ? M1_CELLS : M2_CELLS;
  const cells = Object.fromEntries(
    cellNames.map((name): [string, CellSetup] => {
      const debugFile = join(spec.dir, "debug", `${name}.log`);
      const system =
        spec.kind === "m1"
          ? M1_SYSTEM
          : reviewerSystem(M2_WITH_RULES[name as (typeof M2_CELLS)[number]]);
      const model =
        spec.kind === "m1" ? M1_MODELS[name as (typeof M1_CELLS)[number]] : REVIEWER_MODEL;
      return [
        name,
        {
          provider: oneTurnProvider({
            label: name,
            model,
            systemPrompt: system,
            workDir,
            debugFile,
            maxBudgetUsd: Math.min(ONE_TURN_CAP_USD, spec.runCapUsd),
          }),
          plan: {
            debugFile,
            expectedPlugins: 0,
            workDir: null,
            fixtureBase: null,
            provenance: {
              // M2's patches are diffs against the pinned fixture; M1 has no fixture.
              fixtureCommit: spec.kind === "m2" ? spec.versions.fixture.commit : null,
              bdkCommit: spec.bdkCommit,
              // The cell's system prompt: the rules text is the variable under test.
              variantHash: hash(system),
            },
            settings: { measurement: spec.kind },
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
      runCapUsd: Math.min(ONE_TURN_CAP_USD, spec.runCapUsd),
      resultsFile: spec.resultsFile,
      rawDir: join(spec.dir, "raw"),
    },
    description: `rules no-op ${spec.kind} ${spec.series}`,
    prompt: spec.kind === "m1" ? M1_PROMPT : M2_PROMPT,
    cells,
    items: spec.items,
    runs: spec.runs,
  };
}

const KINDS: readonly MeasurementKind[] = ["m1", "m2"];

function allItems(kind: MeasurementKind): EvalItem[] {
  return kind === "m1" ? m1Items() : m2Items();
}

export function rulesNoopRunner(io: Omit<SeriesIo, "evaluate">): SuiteRunner {
  return {
    async run(options: RunOptions): Promise<number> {
      ensureTools(EVALS_DIR);
      assertCommitted();
      const versions = readVersions();
      const bdkCommit = headCommit();
      const stamp = seriesStamp();
      for (const kind of KINDS) {
        const all = measurementItems(kind, options.patches);
        if (all === null) continue;
        const items = options.probe ? probeItems(all, PROBE_ITEMS[kind]) : all;
        const series = freshSeriesName(
          `${options.probe ? "probe" : "series"}-${kind}-${stamp}`,
          (name) => readRows(resultsFile(SUITE, name)).length > 0,
        );
        const dir = join(RUNS_DIR, "series", SUITE, series);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(join(dir, "empty"), { recursive: true });
        const setup = describeMeasurement({
          kind,
          series,
          dir,
          items,
          bdkCommit,
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
            { probed: items.length, total: all.length },
          );
          for (const line of lines) io.print(`${kind} ${line}`);
        }
        if (code !== 0) return code;
      }
      return 0;
    },

    check(): Promise<void> {
      ensureTools(EVALS_DIR);
      const dir = mkdtempSync(join(tmpdir(), "bdk-evals-check-"));
      try {
        for (const kind of KINDS) {
          const setup = describeMeasurement({
            kind,
            series: `check-${kind}`,
            dir: join(dir, kind),
            items: allItems(kind),
            bdkCommit: "0".repeat(40),
            versions: readVersions(),
            runs: 5,
            budgetUsd: 100,
            runCapUsd: 15,
            ledgerFile: join(dir, "budget.json"),
            resultsFile: join(dir, `${kind}.jsonl`),
          });
          validateConfig(EVALS_DIR, renderSeries(setup, join(dir, kind)).configFile);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return Promise.resolve();
    },

    report(): Promise<void> {
      const file = join(EVALS_DIR, "results", SUITE, "report.md");
      const lines = rulesReport(
        readSuiteRows(join(EVALS_DIR, "results", SUITE)),
        readBullets(),
        readViolations(),
      );
      mkdirSync(join(EVALS_DIR, "results", SUITE), { recursive: true });
      writeFileSync(file, `${lines.join("\n")}\n`);
      io.print(`report: ${file}`);
      return Promise.resolve();
    },
  };
}
