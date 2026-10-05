// `bdk diagnostics report` (`kernel-cli/diagnostics`): reads the journal, the
// agent registry, the Change's attempt records, plan and park questions, the
// settings and the session's transcripts, and hands them to the domain.
import { join } from "node:path";

import { moduleValue, resolveOrRefuse, toolGroup, toolsModule } from "../../shared/config/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, CommandIndex } from "../../shared/registry/index.ts";
import {
  agentsRegistryPath,
  findChange,
  journalPath,
  readAttempts,
  readDocument,
  readPlanParts,
  taskHolders,
  withRegistry,
} from "../../shared/store/index.ts";
import type { RegistryOpener, Store } from "../../shared/store/index.ts";
import { outlierFactorModule, repeatReadModule, repeatRefusalModule } from "../config.ts";
import { buildReport } from "../domain/build.ts";
import type { BuiltReport, ReportInput } from "../domain/build.ts";
import type { AgentFacts, AttemptFacts, NumberedLine, ParkFacts } from "../domain/facts.ts";
import type { DiagnosticsReport } from "../domain/report.ts";
import { defaultSession, sessionChange, transcriptPaths } from "../domain/scope.ts";
import { parseJournal } from "./journal.ts";
import { readSession } from "./transcripts.ts";

export interface DiagnosticsDeps {
  readonly store: Store;
  readonly settings: ConfigRegistry;
  readonly pluginRoot: string;
  readonly git: Git;
  readonly commands: CommandIndex;
  readonly openRegistry: RegistryOpener;
}

export interface Place {
  readonly projectRoot: string;
  readonly globalDir: string;
}

export interface SessionChoice {
  readonly session?: string | undefined;
  readonly stage?: string | undefined;
}

/** The journal and the session a command works on, or the refusal for neither. */
export function chooseSession(
  deps: Pick<DiagnosticsDeps, "store">,
  place: Place,
  choice: SessionChoice,
  active: () => ActiveChange | Refusal,
): { readonly journal: NumberedLine[]; readonly session: string } | Refusal {
  const journal = parseJournal(deps.store.read(journalPath(place.projectRoot)) ?? "");
  if (choice.session !== undefined) return { journal, session: choice.session };
  const change = active();
  const session = defaultSession(journal, "refused" in change ? null : change.id);
  if (session === null) {
    return refuse("input/not-found", "the run journal holds no session", [
      "run a session with BDK installed, then bdk diagnostics report",
    ]);
  }
  return { journal, session };
}

/** The report of the chosen session with what it covers, or the refusal. */
export async function sessionReport(
  deps: DiagnosticsDeps,
  place: Place,
  choice: SessionChoice,
  active: () => ActiveChange | Refusal,
): Promise<BuiltReport | Refusal> {
  const chosen = chooseSession(deps, place, choice, active);
  if ("refused" in chosen) return chosen;
  const input = await reportInput(deps, place, chosen.journal, chosen.session, choice.stage);
  if ("refused" in input) return input;
  const result = buildReport(input);
  if (!("missing" in result)) return result;
  return result.missing === "session"
    ? refuse("input/not-found", `the run journal has no line of session ${chosen.session}`, [
        "bdk diagnostics report",
      ])
    : refuse(
        "input/not-found",
        `session ${chosen.session} never loaded the stage skill ${choice.stage ?? ""}`,
        [`bdk diagnostics report --session ${chosen.session}`],
      );
}

export async function diagnosticsReport(
  deps: DiagnosticsDeps,
  place: Place,
  choice: SessionChoice,
  active: () => ActiveChange | Refusal,
): Promise<DiagnosticsReport | Refusal> {
  const built = await sessionReport(deps, place, choice, active);
  return "refused" in built ? built : built.report;
}

/** Everything `buildReport` reads, for one session. */
export async function reportInput(
  deps: DiagnosticsDeps,
  place: Place,
  journal: readonly NumberedLine[],
  session: string,
  stage: string | undefined,
): Promise<ReportInput | Refusal> {
  const resolved = resolveOrRefuse({ ...deps, ...place });
  if ("refused" in resolved) return resolved;
  const settings = resolved.value;
  const paths = transcriptPaths(journal, session);
  const changeId = sessionChange(journal, session);
  const change =
    changeId === null ? undefined : findChange(deps.store, place.projectRoot, changeId);
  const verbs = new Map(deps.commands.commands.map((record) => [record.id, record.argv]));
  return {
    session,
    stage: stage ?? null,
    journal,
    agents: await agentFacts(deps, place.projectRoot),
    attempts: change === undefined ? [] : attemptFacts(deps.store, change.dir),
    parks: change === undefined ? [] : parkFacts(deps.store, change.dir),
    transcripts: readSession(deps.store, paths.main, paths.agents),
    thresholds: {
      repeatRefusal: moduleValue(repeatRefusalModule, settings),
      repeatRead: moduleValue(repeatReadModule, settings),
      outlierFactor: moduleValue(outlierFactorModule, settings),
    },
    suites: toolGroup(moduleValue(toolsModule, settings), "test").entries.map(
      (entry) => entry.command,
    ),
    partOf: change === undefined ? new Map() : partOf(deps.store, change.dir),
    verbOf: (id) => verbs.get(id),
  };
}

async function agentFacts(deps: DiagnosticsDeps, projectRoot: string): Promise<AgentFacts[]> {
  // A read command never creates the registry.
  if (!deps.store.exists(agentsRegistryPath(projectRoot))) return [];
  const rows = await withRegistry(deps.openRegistry, projectRoot, (registry) => registry.all());
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    session: row.session,
    parent: row.parent,
    ticket: row.ticket,
    role: row.package === null ? null : packageRole(deps.store, join(projectRoot, row.package)),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endedBy: row.endedBy,
  }));
}

function packageRole(store: Store, path: string): string | null {
  try {
    const document = readDocument(store, path);
    const role = document !== undefined && "data" in document ? document.data.role : undefined;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

function attemptFacts(store: Store, changeDir: string): AttemptFacts[] {
  return readAttempts(store, changeDir).map(({ data, body }) => ({
    ticket: data.ticket,
    loop: data.loop,
    target: data.target,
    attempt: data.attempt,
    escalation: data.escalation === true,
    openedAt: data["opened-at"],
    closedAt: data["closed-at"] ?? null,
    reason: body.trim(),
  }));
}

function parkFacts(store: Store, changeDir: string): ParkFacts[] {
  const dir = join(changeDir, "log");
  return store
    .list(dir)
    .filter((name) => name.includes("-question-"))
    .flatMap((name) => {
      const document = readDocument(store, join(dir, name));
      if (document === undefined || !("data" in document)) return [];
      const data = document.data as { id?: unknown; at?: unknown; park?: unknown };
      return data.park === true && typeof data.id === "string" && typeof data.at === "string"
        ? [{ id: data.id, at: data.at }]
        : [];
    });
}

function partOf(store: Store, changeDir: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const [task, part] of taskHolders(readPlanParts(store, changeDir))) parts.set(task, part.id);
  return parts;
}
