// Reads one Change into the `ChangeView` the kinds and the engine work on:
// files on demand through `shared/store`, each read and schema-checked once.
import { join } from "node:path";

import type {
  ChangeView,
  EvidenceFacts,
  FileFacts,
  GraphEntry,
  PlanPartFacts,
  WorkFacts,
} from "../domain/kinds/index.ts";
import { moduleValue, toolGroup, toolGroupStates, toolsModule } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { KernelRefusal } from "../../shared/refusal/index.ts";
import {
  firstMatch,
  parsePlanTasks,
  planPlaceholders,
  readAttempts,
  readDocument,
} from "../../shared/store/index.ts";
import type { AttemptRecord, EntryRow, Store } from "../../shared/store/index.ts";
import type { Profile } from "../../shared/vocabulary/index.ts";
import { deltaCapabilities, deltaProblems } from "../../spec/index.ts";
import { planPartModule } from "../config.ts";

export interface ViewInput {
  readonly store: Store;
  readonly id: string;
  readonly dir: string;
  readonly projectRoot: string;
  readonly kind: string;
  readonly profile: Profile;
  readonly entries: readonly EntryRow[];
  readonly work?: WorkFacts | undefined;
  /** The Change's manifests with their freshness, ordered by `at`, then id. */
  readonly evidence?: readonly EvidenceFacts[];
  /** Plan part number -> its current tree hash, when computed. */
  readonly partTrees?: ReadonlyMap<string, string>;
  /** The current tree hash of the Change, when computed. */
  readonly changeTree?: string | undefined;
  /** The resolved settings, for `spec.normative-word` and the `tools.test` coverage thresholds. */
  readonly settings: Readonly<Mapping>;
}

interface Read {
  readonly facts: FileFacts;
  readonly body?: string;
}

export function changeView(input: ViewInput): ChangeView {
  const { store, dir } = input;
  const files = new Map<string, Read | undefined>();
  const parts = new Map<string, PlanPartFacts | undefined>();
  const byId = new Map(input.entries.map((entry) => [entry.id, entry]));
  let records: ReadonlyMap<string, AttemptRecord> | undefined;
  const record = (ticket: string): AttemptRecord | undefined => {
    records ??= new Map(readAttempts(store, dir).map(({ data }) => [data.ticket, data]));
    return records.get(ticket);
  };
  const ticketLoop = (ticket: string): string | undefined => record(ticket)?.loop;
  const ticketOutcome = (ticket: string): string | undefined => record(ticket)?.outcome;
  const read = (path: string): Read | undefined => {
    if (files.has(path)) return files.get(path);
    const facts = readFacts(store, join(dir, path));
    files.set(path, facts);
    return facts;
  };
  const planPart = (path: string): PlanPartFacts | undefined => {
    if (parts.has(path)) return parts.get(path);
    const found = read(path);
    const facts =
      found?.facts.data === undefined || found.body === undefined
        ? undefined
        : planPartFacts(found.facts.data, found.body);
    parts.set(path, facts);
    return facts;
  };
  /** The frontmatter of the report file a `report` entry names. */
  const reportData = (entry: GraphEntry): Readonly<Record<string, unknown>> | undefined => {
    const row = byId.get(entry.id);
    if (row === undefined) return undefined;
    const report = documentData(store, join(input.projectRoot, row.path))?.report;
    return typeof report === "string" ? documentData(store, join(dir, report)) : undefined;
  };
  const tools = moduleValue(toolsModule, input.settings);
  const partLimits = moduleValue(planPartModule, input.settings);
  return {
    id: input.id,
    kind: input.kind,
    profile: input.profile,
    entries: input.entries,
    file: (path) => read(path)?.facts,
    list: (sub) => store.list(join(dir, sub)).filter((name) => !name.endsWith("/")),
    specDeltas: () => deltaCapabilities(store, dir),
    specProblems: (capability) => deltaProblems(store, input, capability, input.settings),
    reportStatus: (entry: GraphEntry) => {
      const status = reportData(entry)?.status;
      return typeof status === "string" ? status : undefined;
    },
    reportEvidence: (entry: GraphEntry) => {
      const evidence = reportData(entry)?.evidence;
      return Array.isArray(evidence) ? evidence.map(String) : [];
    },
    planPart,
    evidence: input.evidence ?? [],
    partTree: (nn) => input.partTrees?.get(nn),
    changeTree: () => input.changeTree,
    coverageTools: toolGroup(tools, "test")
      .entries.filter((entry) => entry.coverage?.min !== undefined)
      .map((entry) => entry.id),
    partLimits: {
      maxTasks: partLimits["max-tasks"],
      maxFiles: partLimits["max-files"],
    },
    toolGroups: toolGroupStates(tools),
    ticketLoop,
    ticketOutcome,
    ...(input.work === undefined ? {} : { work: input.work }),
  };
}

/** The task grammar, the placeholders and the `do-not-touch` overlaps of a plan part. */
function planPartFacts(data: Readonly<Record<string, unknown>>, body: string): PlanPartFacts {
  const { tasks, problems } = parsePlanTasks(body);
  const globs = Array.isArray(data["do-not-touch"]) ? data["do-not-touch"].map(String) : [];
  const overlaps = tasks.flatMap((task) =>
    task.files.flatMap(({ path }) => {
      const glob = firstMatch(globs, path);
      return glob === undefined ? [] : [{ task: task.id, path, glob }];
    }),
  );
  return {
    tasks: tasks.map((task) => ({ id: task.id, files: task.files.map((file) => file.path) })),
    problems,
    placeholders: planPlaceholders(
      {
        goal: text(data.goal),
        "success-measure": text(data["success-measure"]),
        ...(data["isolation-reason"] === undefined
          ? {}
          : { "isolation-reason": text(data["isolation-reason"]) }),
      },
      tasks,
    ),
    overlaps,
  };
}

function readFacts(store: Store, path: string): Read | undefined {
  const text = store.read(path);
  if (text === undefined) return undefined;
  const bytes = Buffer.byteLength(text);
  try {
    const document = readDocument(store, path);
    if (document === undefined) return undefined;
    const { body } = document;
    const blank = body.trim() === "";
    return {
      facts: "data" in document ? { bytes, blank, data: document.data } : { bytes, blank },
      body,
    };
  } catch (error) {
    if (!(error instanceof KernelRefusal)) throw error;
    return { facts: { bytes, blank: text.trim() === "", invalid: error.refusal.why } };
  }
}

function documentData(store: Store, path: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const document = readDocument(store, path);
    return document !== undefined && "data" in document ? document.data : undefined;
  } catch (error) {
    if (error instanceof KernelRefusal) return undefined;
    throw error;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
