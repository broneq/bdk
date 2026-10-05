// The continuation check of `bdk hooks stop` and `bdk hooks subagent-stop`
// (`kernel-cli/hooks`, Continuation check; T41-D7): a turn that ends while
// the thread's own scope holds work it can do now is sent back, at most
// `agents.continuation.max` times without progress. Every doubt passes: a
// payload outside a BDK project, a non-BDK agent, a broken Change, a question
// to the user, a background task still running. A hook never traps the user.
import { reportStatus, recordEnd } from "../../agents/index.ts";
import { readGraph, stageWork } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { moduleValue } from "../../shared/config/index.ts";
import { trailerCommits } from "../../shared/git/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  listEntries,
  openAttempts,
  readAttempts,
  readDocument,
  readPlanParts,
} from "../../shared/store/index.ts";
import type { AgentRow, EntryRow, IndexDb } from "../../shared/store/index.ts";
import { continuationModule } from "../config.ts";
import { agentEventPayload } from "../domain/payload.ts";
import type { AgentEventPayload } from "../domain/payload.ts";
import type { StopReport } from "../domain/report.ts";

export type { StopReport };
import { activeChangeOf, bdkProject, onRegistry, settingsOf } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";
import { journalAgentStop } from "./journal.ts";

/** The work a thread can still do now; undefined when it has none. */
interface OpenWork {
  readonly reason: string;
  readonly refs: readonly string[];
  /** What counts as progress in the thread's scope; a change resets `continuations`. */
  readonly progress: string;
}

/** Where the counter of a thread lives: the session row for main, the agent row otherwise. */
interface Counter {
  readonly continuations: number;
  readonly progress: string | null;
}

const PASS = { decision: "pass" } as const;

/** The ledger's `summary` limit (`kernel-state`, Ledger entry). */
const SUMMARY_LIMIT = 120;

export async function mainStop(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<StopReport> {
  const payload = agentEventPayload(raw);
  const session = payload?.session;
  const projectRoot = bdkProject(deps, place);
  if (payload === undefined || session === undefined || projectRoot === undefined) {
    return { ...PASS, continuations: 0 };
  }
  const stored = await onRegistry(deps, projectRoot, (registry) => registry.session(session));
  const counter = counterOf(stored);
  const outcome = await checked(deps, place, payload, counter, (change, index) =>
    mainWork(deps, place, change, index, session),
  );
  await onRegistry(deps, projectRoot, (registry) => {
    registry.putSession({ session, ...outcome.counter });
  });
  return outcome.report;
}

export async function subagentStop(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<StopReport> {
  const payload = agentEventPayload(raw);
  const id = payload?.agentId;
  const projectRoot = bdkProject(deps, place);
  if (payload === undefined || id === undefined || projectRoot === undefined) {
    return { agent: id ?? null, ...PASS, continuations: 0 };
  }
  const row = await onRegistry(deps, projectRoot, (registry) => registry.get(id));
  const counter = counterOf(row);
  const bdkAgent = (payload.agentType ?? row?.type ?? "").startsWith("bdk:");
  const outcome =
    bdkAgent && row !== undefined
      ? await checked(deps, place, payload, counter, (change, index) =>
          agentWork(deps, change, index, row, payload.agentType ?? row.type ?? ""),
        )
      : { report: { ...PASS, continuations: counter.continuations }, counter };
  await onRegistry(deps, projectRoot, (registry) => {
    registry.transaction(() => {
      registry.put(id, outcome.counter);
      if (outcome.report.decision === "pass") {
        recordEnd(registry, id, "subagent-stop", deps.clock.now());
      }
    });
  });
  if (outcome.report.decision === "pass") {
    await journalAgentStop(
      deps,
      projectRoot,
      { agent: id, by: "subagent-stop", transcript: payload.agentTranscript },
      payload.session,
    );
  }
  return { agent: id, ...outcome.report };
}

function counterOf(stored: Counter | undefined): Counter {
  return { continuations: stored?.continuations ?? 0, progress: stored?.progress ?? null };
}

type Work = (change: ActiveChange, index: IndexDb) => Promise<OpenWork | undefined>;

/** Runs the check shared by both threads; any failure passes. */
async function checked(
  deps: HooksDeps,
  place: HookPlace,
  payload: AgentEventPayload,
  counter: Counter,
  work: Work,
): Promise<{ report: StopReport; counter: Counter }> {
  const pass = { report: { ...PASS, continuations: counter.continuations }, counter };
  const running = payload.runningTasks.filter((task) => task !== payload.agentId);
  const change = activeChangeOf(deps, place);
  if (running.length > 0 || change === undefined) return pass;
  const settings = settingsOf(deps, change.projectRoot, place);
  if (settings === undefined) return pass;
  const max = moduleValue(continuationModule, settings).max;
  try {
    return await withChangeIndex(deps, change, async (index) => {
      if (waitsOnUser(index, change)) return pass;
      const open = await work(change, index);
      if (open === undefined) return pass;
      const continuations = counter.progress === open.progress ? counter.continuations : 0;
      if (continuations < max) {
        const next = { continuations: continuations + 1, progress: open.progress };
        return {
          report: {
            decision: "block" as const,
            reason: open.reason,
            continuations: next.continuations,
          },
          counter: next,
        };
      }
      const stalledCounter = { continuations: max + 1, progress: open.progress };
      if (continuations > max) {
        return { report: { ...PASS, continuations: max + 1 }, counter: stalledCounter };
      }
      const written = await appendEntry(
        deps,
        change,
        index,
        {
          type: "finding",
          summary: `stopped ${String(max)} times with work open on ${open.refs.join(", ")}`.slice(
            0,
            SUMMARY_LIMIT,
          ),
          refs: open.refs,
          body: `The continuation check sent this thread back ${String(max)} times without progress, so it passed and the work stays open.\n\n${open.reason}\n`,
          review: true,
        },
        { dedupe: false },
      );
      return {
        report: {
          ...PASS,
          continuations: max + 1,
          ...(isRefusal(written) ? {} : { stalled: written.entry.id }),
        },
        counter: stalledCounter,
      };
    });
  } catch {
    return pass;
  }
}

/** A parked Change or a `question` no decision answers: the turn ends for the user. */
function waitsOnUser(index: IndexDb, change: ActiveChange): boolean {
  const entries = entriesOf(index, change);
  return entries.some(
    (entry) =>
      entry.type === "question" &&
      entry.status !== "superseded" &&
      !entries.some((other) => other.type === "decision" && other.refs.includes(entry.id)),
  );
}

function entriesOf(index: IndexDb, change: ActiveChange): readonly EntryRow[] {
  return listEntries(index, change.id);
}

/** Progress in a scope: its entries, the stall findings aside, and its closed tickets. */
function progressOf(
  entries: readonly EntryRow[],
  closed: number,
  inScope: (entry: EntryRow) => boolean,
): string {
  const counted = entries.filter(
    (entry) => inScope(entry) && !(entry.type === "finding" && entry.source === "kernel"),
  );
  return `${String(counted.length)}/${String(closed)}`;
}

async function mainWork(
  deps: HooksDeps,
  place: HookPlace,
  change: ActiveChange,
  index: IndexDb,
  session: string,
): Promise<OpenWork | undefined> {
  const entries = entriesOf(index, change);
  const opened = [...entries]
    .filter((entry) => entry.type === "transition")
    .sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)))
    .find((entry) => sessionOf(deps, change, entry) === session);
  if (opened?.to === undefined) return undefined;
  const read = await readGraph(deps, change, index, place.globalDir);
  if (isRefusal(read)) return undefined;
  const node = stageWork(read, opened.to);
  if (node === undefined) return undefined;
  const closed = readAttempts(deps.store, change.dir).filter(
    (record) => record.data.outcome !== undefined,
  ).length;
  return {
    reason: `BDK: ${node.id} is ${node.state} (bdk next). Continue it; end your turn only to ask the user a question or to report a blocker.`,
    refs: [node.id],
    progress: progressOf(entries, closed, () => true),
  };
}

function sessionOf(deps: HooksDeps, change: ActiveChange, entry: EntryRow): string | undefined {
  const document = readDocument(deps.store, `${change.projectRoot}/${entry.path}`);
  if (document === undefined || !("data" in document)) return undefined;
  const session = (document.data as { session?: unknown }).session;
  return typeof session === "string" ? session : undefined;
}

async function agentWork(
  deps: HooksDeps,
  change: ActiveChange,
  index: IndexDb,
  row: AgentRow,
  type: string,
): Promise<OpenWork | undefined> {
  const open = openAttempts(index, change.id);
  const ticket = row.ticket;
  if (row.package === null || ticket === null) return undefined;
  if (!open.some((attempt) => attempt.ticket === ticket)) return undefined;
  const entries = entriesOf(index, change);
  const reported = reportStatus(deps.store, change.projectRoot, row.package) !== undefined;
  const storeReport = `your report for ${ticket} is not stored. Pipe it to bdk log ingest --ticket ${ticket}, then return your envelope.`;
  if (type !== "bdk:lead") {
    if (reported) return undefined;
    return {
      reason: `BDK: ${storeReport}`,
      refs: [ticket],
      progress: progressOf(entries, 0, (entry) => entry.ticket === ticket),
    };
  }
  const part = row.target;
  if (part === null) return undefined;
  const ofPart = (target: string): boolean => target === part || target.startsWith(`${part}-`);
  const attempts = readAttempts(deps.store, change.dir).filter((record) =>
    ofPart(record.data.target),
  );
  const tickets = new Set(attempts.map((record) => record.data.ticket));
  const closed = attempts.filter((record) => record.data.outcome !== undefined).length;
  const progress = progressOf(
    entries,
    closed,
    (entry) => entry.ticket !== undefined && tickets.has(entry.ticket),
  );
  const elapsed = elapsedOf(deps, row);
  const task = open.find((attempt) => attempt.ticket !== ticket && ofPart(attempt.target));
  if (task !== undefined) {
    return {
      reason: `BDK: ticket ${task.ticket} for ${task.target} of part ${part} is open. Wait for its agent with bdk agents wait ${row.id}, or close it with bdk attempt close; elapsed ${elapsed}s.`,
      refs: [task.target],
      progress,
    };
  }
  const commits = await trailerCommits(deps.git, change.projectRoot, change.id);
  const tasks = readPlanParts(deps.store, change.dir).find(
    (candidate) => candidate.id === part,
  )?.tasks;
  const uncommitted = (tasks ?? []).find(
    (candidate) => !commits.some((commit) => commit.part === part && commit.task === candidate.id),
  );
  if (uncommitted !== undefined) {
    return {
      reason: `BDK: task ${uncommitted.id} of part ${part} is not committed. Dispatch it or commit it; end your turn only to report a blocker; elapsed ${elapsed}s.`,
      refs: [uncommitted.id],
      progress,
    };
  }
  if (reported) return undefined;
  return { reason: `BDK: ${storeReport} Elapsed ${elapsed}s.`, refs: [part], progress };
}

function elapsedOf(deps: HooksDeps, row: AgentRow): string {
  const since = Date.parse(row.startedAt ?? row.linkedAt ?? deps.clock.now());
  return String(Math.max(0, Math.floor((Date.parse(deps.clock.now()) - since) / 1000)));
}
