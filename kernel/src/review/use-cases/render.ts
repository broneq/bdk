// `bdk review render [--format html|md] [--out <path>] [--pr <file|->]`
// (`kernel-cli/review`; T42-H, J): the human review report of the Change,
// rendered from the ledger, the evidence, the plan parts and the diff of the
// whole Change, or the decision page of a pull request review from its parsed
// results. Writes only the output file.
import { isAbsolute, join, relative, sep } from "node:path";

import {
  moduleValue,
  resolveOrRefuse,
  toolGroup,
  toolGroupStates,
  toolsModule,
} from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { headCommit, rangeCommits } from "../../shared/git/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { groupsNotUsed } from "../../shared/vocabulary/index.ts";
import {
  changeBase,
  EMPTY_TREE,
  findChangeRow,
  listEntries,
  matchesGlob,
  readAttempts,
  readDocument,
  readManifests,
  readPlanParts,
  refreshChange,
  withIndex,
} from "../../shared/store/index.ts";
import type { ManifestFile } from "../../shared/store/index.ts";
import { moduleOf, rangeFiles } from "../../measure/index.ts";
import { listDeltas } from "../../spec/index.ts";
import { risksModule, trackerModule } from "../config.ts";
import { prPage } from "../domain/pr.ts";
import type { PrInput } from "../domain/pr.ts";
import { areaLines, changeReport, intentRows } from "../domain/report.ts";
import type {
  CoverageInput,
  IntentKey,
  IntentRow,
  ReportCommit,
  ReportEntry,
  Tracker,
} from "../domain/report.ts";
import type { PrPage } from "../domain/pr.ts";
import type { ChangeReport } from "../domain/report.ts";
import type { RenderResult } from "../domain/render.ts";
import type { ReviewDeps } from "./plan.ts";

export type Format = "html" | "md";

/** The templates the handler passes in: `render/` owns the bytes, this use case the inputs. */
export interface Templates {
  readonly change: (report: ChangeReport) => string;
  readonly pr: (page: PrPage) => string;
}

interface Where {
  readonly projectRoot: string;
  readonly cwd: string;
  readonly globalDir: string;
}

const MACHINE_REVIEW = ".bdk/.machine/review";
const INTEGRATION_REVIEWER = "integration-reviewer";

export async function renderChangeReport(
  deps: ReviewDeps,
  change: ActiveChange,
  input: {
    readonly format: Format;
    readonly out: string | undefined;
    readonly cwd: string;
    readonly globalDir: string;
    readonly templates: Templates;
  },
): Promise<RenderResult | Refusal> {
  const root = change.projectRoot;
  const settings = settingsOf(deps, { projectRoot: root, cwd: root, globalDir: input.globalDir });
  if (isRefusal(settings)) return settings;
  const head = (await headCommit(deps.git, root)) ?? EMPTY_TREE;
  const base = await changeBase(deps.store, deps.git, root, change.dir);
  const files = await rangeFiles(deps, root, base, head);
  if (isRefusal(files)) return files;
  const commits = await commitsByFile(deps, root, base, head);

  const { entries, intent, kind } = await withIndex(deps.openIndex, deps.store, root, (index) => {
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    const row = findChangeRow(index, change.id);
    return {
      intent: row?.intent ?? change.id,
      kind: row?.kind ?? "feature",
      entries: listEntries(index, change.id).map((entry): ReportEntry => ({
        ...entry,
        body: bodyOf(deps, join(root, entry.path)),
      })),
    };
  });
  const tracker = trackerOf(settings);
  const integration = integrationReports(deps, change);
  const report = changeReport({
    change: change.id,
    intent,
    kind,
    range: `${base}..${head}`,
    files,
    parts: readPlanParts(deps.store, change.dir).map((part) => ({
      id: part.id,
      title: part.data.title,
      tasks: part.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        files: task.files.map((file) => file.path),
      })),
    })),
    commits,
    risks: moduleValue(risksModule, settings).filter((risk) => risk.enabled),
    areas: areasOf(integration),
    scenarios: scenariosOf(deps, change),
    traced: tracedOf(integration),
    entries,
    gate: gateOf(deps, change, settings),
    tracker,
    moduleOf,
    matches: matchesGlob,
  });
  const path =
    input.out === undefined
      ? join(root, MACHINE_REVIEW, `${change.id}.${input.format}`)
      : resolveOut(input.cwd, input.out);
  deps.store.write(path, input.templates.change(report));
  const decisions = report.decisions.flatMap((group) => group.entries);
  return {
    change: change.id,
    format: input.format,
    path: shown(root, path),
    range: report.range,
    undecided: decisions
      .filter((entry) => entry.disposition === undefined)
      .map((entry) => entry.id),
    decided: decisions.filter((entry) => entry.disposition !== undefined).map((entry) => entry.id),
    tracker: tracker ?? null,
  };
}

export function renderPrPage(
  deps: ReviewDeps,
  where: Where,
  input: {
    readonly format: Format;
    readonly out: string;
    readonly prs: PrInput;
    readonly templates: Templates;
  },
): RenderResult | Refusal {
  const settings = settingsOf(deps, where);
  if (isRefusal(settings)) return settings;
  const tracker = trackerOf(settings);
  const page = prPage(input.prs, tracker !== undefined);
  const path = resolveOut(where.cwd, input.out);
  deps.store.write(path, input.templates.pr(page));
  return {
    change: null,
    format: input.format,
    path: shown(where.projectRoot, path),
    range: null,
    undecided: page.prs.flatMap((pr) => pr.findings.map((finding) => finding.id)),
    decided: [],
    tracker: tracker ?? null,
  };
}

/** `--pr` without `--out` (`input/missing-argument`). */
export function missingOut(): Refusal {
  return refuse("input/missing-argument", "--pr writes only --out: name the page file", [
    "bdk review render --pr - --out $(mktemp -t pr-review).html",
  ]);
}

function settingsOf(deps: ReviewDeps, where: Where): Mapping | Refusal {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir: where.globalDir,
      projectRoot: where.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  return isRefusal(resolved) ? resolved : resolved.value;
}

function trackerOf(settings: Mapping): Tracker | undefined {
  return moduleValue(trackerModule, settings)?.kind;
}

/** The commits of the range per changed path, oldest first; `.bdk/` paths left out. */
async function commitsByFile(
  deps: ReviewDeps,
  root: string,
  base: string,
  head: string,
): Promise<Map<string, ReportCommit[]>> {
  const byFile = new Map<string, ReportCommit[]>();
  if (head === EMPTY_TREE) return byFile;
  const commits = await rangeCommits(deps.git, root, base === EMPTY_TREE ? undefined : base, head);
  for (const commit of commits) {
    for (const path of commit.files) {
      byFile.set(path, [
        ...(byFile.get(path) ?? []),
        { sha: commit.commit, subject: commit.subject },
      ]);
    }
  }
  return byFile;
}

/** The bodies of the integration reviewer's reports, oldest round first by the ticket's `opened-at`. */
function integrationReports(deps: ReviewDeps, change: ActiveChange): string[] {
  const opened = new Map(
    readAttempts(deps.store, change.dir).map((attempt) => [
      attempt.data.ticket,
      attempt.data["opened-at"],
    ]),
  );
  const dir = join(change.dir, "reports");
  const reports = deps.store
    .list(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      const document = readDocument(deps.store, join(dir, name));
      if (document?.kind !== "report" || !("data" in document)) return [];
      const data = document.data as { role?: string; ticket?: string };
      if (data.role !== INTEGRATION_REVIEWER) return [];
      return [{ name, at: opened.get(data.ticket ?? "") ?? "", body: document.body }];
    })
    .sort((a, b) => compare(a.at, b.at) || compare(a.name, b.name));
  return reports.map((report) => report.body);
}

/** The `## Areas` lines of the integration reports; a later report overrides per id. */
function areasOf(reports: readonly string[]): Map<string, string> {
  const areas = new Map<string, string>();
  for (const body of reports) {
    for (const [id, sentence] of areaLines(body)) areas.set(id, sentence);
  }
  return areas;
}

/** The `## Intent` rows of the latest integration report that holds the table (#158). */
function tracedOf(reports: readonly string[]): IntentRow[] | undefined {
  return reports
    .map(intentRows)
    .filter((rows) => rows !== undefined)
    .at(-1);
}

/**
 * The scenarios of the Change's spec deltas: every scenario of an `ADDED`
 * or `MODIFIED` requirement, and `-` for a `REMOVED` one, capability by
 * capability in the order each delta lists them.
 */
function scenariosOf(deps: ReviewDeps, change: ActiveChange): IntentKey[] {
  return listDeltas(deps.store, change.dir).flatMap(({ capability, delta }) => [
    ...[...delta.added, ...delta.modified].flatMap((requirement) =>
      requirement.scenarios.map((scenario) => ({
        capability,
        requirement: requirement.name,
        scenario: scenario.name,
      })),
    ),
    ...delta.removed.map((removal) => ({ capability, requirement: removal.name, scenario: "-" })),
  ]);
}

function gateOf(deps: ReviewDeps, change: ActiveChange, settings: Mapping) {
  const manifests = readManifests(deps.store, change.dir);
  const latest = (match: (manifest: ManifestFile) => boolean) => manifests.filter(match).at(-1);
  const tools = moduleValue(toolsModule, settings);
  const coverage: CoverageInput[] = toolGroup(tools, "test")
    .entries.filter((entry) => entry.coverage !== undefined)
    .map((entry) => {
      const manifest = latest(
        (item) => item.data.kind === "coverage" && item.data.tool === entry.id,
      );
      return {
        tool: entry.id,
        min: entry.coverage?.min ?? null,
        percent: manifest === undefined ? null : percentOf(deps, change.projectRoot, manifest),
        verdict: manifest?.data.verdict,
      };
    });
  return {
    tests: latest((item) => item.data.kind === "tests-full")?.data.verdict,
    lint: latest((item) => item.data.kind === "lint-full")?.data.verdict,
    coverage,
    notUsed: groupsNotUsed(toolGroupStates(tools)),
  };
}

/** `percent` of the summary file a coverage manifest records first; null when it is gone. */
function percentOf(deps: ReviewDeps, root: string, manifest: ManifestFile): number | null {
  const file = manifest.data.files[0];
  const text = file === undefined ? undefined : deps.store.read(join(root, file.path));
  if (text === undefined) return null;
  try {
    const percent = (JSON.parse(text) as { percent?: unknown }).percent;
    return typeof percent === "number" ? percent : null;
  } catch {
    return null;
  }
}

function bodyOf(deps: ReviewDeps, path: string): string {
  const document = readDocument(deps.store, path);
  return document !== undefined && "body" in document ? document.body : "";
}

function resolveOut(from: string, out: string): string {
  return isAbsolute(out) ? out : join(from, out);
}

/** Relative to the project root when inside it, absolute otherwise. */
function shown(root: string, path: string): string {
  const rel = relative(root, path);
  return rel.startsWith("..") || isAbsolute(rel) ? path : rel.split(sep).join("/");
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
