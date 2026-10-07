// A `ChangeView` from literals, for the pure tests of the kinds, the engine
// and the gate rule: files by path, entries in order, report statuses by id.
import type {
  ChangeView,
  EvidenceFacts,
  FileFacts,
  GraphEntry,
  Inputs,
  PlanPartFacts,
  WorkFacts,
} from "../domain/kinds/index.ts";
import type { Profile, ToolGroupName, ToolGroupState } from "../../shared/vocabulary/index.ts";

export interface ViewFixture {
  readonly profile?: Profile;
  readonly kind?: string;
  readonly files?: Readonly<Record<string, Partial<FileFacts>>>;
  readonly entries?: readonly (Partial<GraphEntry> & {
    readonly id: string;
    readonly type: string;
  })[];
  /** Entry id -> the status of the report it points at. */
  readonly reports?: Readonly<Record<string, string>>;
  /** Plan part path -> its parsed body; a plan part file without one holds task `<nn>-1`. */
  readonly planParts?: Readonly<Record<string, Partial<PlanPartFacts>>>;
  readonly work?: WorkFacts;
  /** Evidence manifests in order; `at` defaults to 10:00, `cited` to false, `fresh` to true. */
  readonly evidence?: readonly (Partial<EvidenceFacts> & {
    readonly id: string;
    readonly kind: string;
    readonly target: string;
  })[];
  /** Entry id -> the `evidence` ids its report file lists. */
  readonly reportEvidence?: Readonly<Record<string, readonly string[]>>;
  /** Plan part number -> its current tree hash. */
  readonly partTrees?: Readonly<Record<string, string>>;
  /** The current tree hash of the Change. */
  readonly changeTree?: string;
  /** The `tools.test` ids with `coverage.min`. */
  readonly coverageTools?: readonly string[];
  /** The state of each tool group; `configured` when left out. */
  readonly toolGroups?: Partial<Record<ToolGroupName, ToolGroupState>>;
  readonly partLimits?: { readonly maxTasks?: number; readonly maxFiles?: number };
  /** Ticket -> its loop. */
  readonly loops?: Readonly<Record<string, string>>;
  /** Ticket -> the outcome it closed with; a ticket of `loops` missing here closed `ok`. */
  readonly outcomes?: Readonly<Record<string, string | undefined>>;
  /** Capability -> the problems of its delta; a delta file without an item has none. */
  readonly specProblems?: Readonly<Record<string, readonly string[]>>;
}

export function fakeView(fixture: ViewFixture = {}): ChangeView {
  const files = fixture.files ?? {};
  return {
    id: "2026-09-25-login",
    kind: fixture.kind ?? "feature",
    profile: fixture.profile ?? "small",
    entries: (fixture.entries ?? []).map((entry) => ({
      at: "2026-09-25T10:00:00.000Z",
      source: "kernel",
      refs: ["change.md"],
      summary: "fixture",
      status: "accepted",
      review: false,
      ...entry,
    })),
    file: (path) => {
      const facts = files[path];
      return facts === undefined ? undefined : { bytes: 10, blank: false, ...facts };
    },
    list: (dir) =>
      Object.keys(files)
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes("/"))
        .map((path) => path.slice(dir.length + 1))
        .sort(),
    specDeltas: () =>
      Object.keys(files)
        .filter((path) => path.startsWith("spec-delta/") && path.endsWith(".md"))
        .map((path) => path.slice("spec-delta/".length, -".md".length))
        .sort(),
    specProblems: (capability) =>
      files[`spec-delta/${capability}.md`] === undefined
        ? undefined
        : (fixture.specProblems?.[capability] ?? []),
    reportStatus: (entry) => fixture.reports?.[entry.id],
    reportEvidence: (entry) => fixture.reportEvidence?.[entry.id] ?? [],
    evidence: (fixture.evidence ?? []).map((manifest) => ({
      at: "2026-09-25T10:00:00.000Z",
      cited: false,
      fresh: true,
      ...manifest,
    })),
    partTree: (nn) => fixture.partTrees?.[nn],
    changeTree: () => fixture.changeTree,
    coverageTools: fixture.coverageTools ?? [],
    partLimits: { maxTasks: 5, maxFiles: 10, ...fixture.partLimits },
    toolGroups: { test: "configured", lint: "configured", ...fixture.toolGroups },
    ticketLoop: (ticket) => fixture.loops?.[ticket],
    ticketOutcome: (ticket) =>
      fixture.outcomes !== undefined && ticket in fixture.outcomes
        ? fixture.outcomes[ticket]
        : fixture.loops?.[ticket] === undefined
          ? undefined
          : "ok",
    planPart: (path) => {
      if (files[path] === undefined) return undefined;
      const nn = /(\d{2})-[^/]*\.md$/.exec(path)?.[1] ?? "01";
      return {
        tasks: [{ id: `${nn}-1`, files: ["src/a.ts"] }],
        problems: [],
        placeholders: [],
        overlaps: [],
        ...fixture.planParts?.[path],
      };
    },
    ...(fixture.work === undefined ? {} : { work: fixture.work }),
  };
}

/** A deterministic stand-in for sha256: the inputs themselves, readable in assertions. */
export function fakeHash(
  versions: Readonly<Record<string, string>> = {},
): (inputs: Inputs) => string {
  return (inputs) => {
    if ("codeTree" in inputs) return `tree@${versions.tree ?? "1"}`;
    if ("none" in inputs) throw new Error("hash asked for none");
    if ("tree" in inputs) return inputs.tree;
    return inputs.files.map((path) => `${path}@${versions[path] ?? "1"}`).join(",");
  };
}
