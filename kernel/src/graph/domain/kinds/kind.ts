// The contract every artifact kind implements (`kernel-pipeline`, Artifact
// kinds; design D-2). A kind owns its files, its hash inputs, whether it
// applies, its instances, its validator and how it becomes done. Kinds are
// pure: the use cases read the Change into a `ChangeView` and hash the inputs.
import type { Profile } from "../../../shared/vocabulary/index.ts";

/** A file of the Change directory as the use case read it. */
export interface FileFacts {
  readonly bytes: number;
  /** True when the body (the whole text of an opaque file) holds only whitespace. */
  readonly blank: boolean;
  /** The frontmatter of a schema-checked document that validated. */
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  /** Why the file fails its `kernel-state` schema. */
  readonly invalid?: string | undefined;
}

/** The fields of a ledger entry the graph reads; `EntryRow` of the index has them all. */
export interface GraphEntry {
  readonly id: string;
  readonly type: string;
  readonly at: string;
  readonly source: string;
  readonly refs: readonly string[];
  readonly summary: string;
  readonly status: string;
  readonly review: boolean;
  readonly to?: string | undefined;
  readonly gate?: string | undefined;
  readonly inputHash?: string | undefined;
  /** A policy transition written under a run's `--auto` (T41). */
  readonly auto?: boolean | undefined;
}

/** A plan part's body as the use case parsed it with the task grammar (`kernel-loops`). */
export interface PlanPartFacts {
  readonly tasks: readonly { readonly id: string; readonly files: readonly string[] }[];
  /** Grammar problems, one sentence each. */
  readonly problems: readonly string[];
  /** The executable fields holding a placeholder, named for a refusal. */
  readonly placeholders: readonly string[];
  /** Each `Files:` path of a task matching a `do-not-touch` glob of the part. */
  readonly overlaps: readonly {
    readonly task: string;
    readonly path: string;
    readonly glob: string;
  }[];
}

/** A commit carrying the BDK trailers of a task (`kernel-loops`, Progress from git). */
interface TaskCommit {
  readonly commit: string;
  readonly part: string;
  readonly task: string;
}

/**
 * The committed work the `execute-part` checks read: the Change's trailer
 * commits from git and its open tickets from the index. Only the commands
 * that run a validator load them, so `next` never spawns `git log`.
 */
export interface WorkFacts {
  readonly commits: readonly TaskCommit[];
  /** Open tickets with their target: a task id, a part id or the Change id. */
  readonly openTickets: readonly { readonly ticket: string; readonly target: string }[];
}

/**
 * An evidence manifest of the Change as the step kinds read it
 * (`kernel-state`, Evidence manifest); the use case computed `fresh` against
 * the current tree hash of the manifest's own target.
 */
export interface EvidenceFacts {
  readonly id: string;
  readonly kind: string;
  readonly target: string;
  readonly at: string;
  readonly verdict?: string | undefined;
  /** True when the manifest carries at least one citation. */
  readonly cited: boolean;
  readonly fresh: boolean;
}

/** One Change as the kinds and the engine see it. */
export interface ChangeView {
  readonly id: string;
  /** `feature` or `bug`. */
  readonly kind: string;
  /** The effective profile. */
  readonly profile: Profile;
  /** Ordered by `at`, then id. */
  readonly entries: readonly GraphEntry[];
  /** A file by its path relative to the Change directory, or undefined when absent. */
  file(path: string): FileFacts | undefined;
  /** The file names directly in a directory of the Change, sorted; [] when absent. */
  list(dir: string): readonly string[];
  /** The capabilities with a delta under `spec-delta/`, nested by path, in path order. */
  specDeltas(): readonly string[];
  /**
   * `spec delta check`'s problems of a capability's delta, each as
   * `<path>:<line> <code>: <message>`; undefined when the Change has no delta for it.
   */
  specProblems(capability: string): readonly string[] | undefined;
  /** The `status` of the report file a `report` entry names, or undefined. */
  reportStatus(entry: GraphEntry): string | undefined;
  /** The parsed body of a plan part whose frontmatter validated, by its Change-relative path. */
  planPart(path: string): PlanPartFacts | undefined;
  /** The `evidence` ids the report file of a `report` entry lists; [] when unreadable. */
  reportEvidence(entry: GraphEntry): readonly string[];
  /** The evidence manifests of the Change, ordered by `at`, then id. */
  readonly evidence: readonly EvidenceFacts[];
  /** The current tree hash of plan part `nn`, when the use case computed it. */
  partTree(nn: string): string | undefined;
  /** Loaded by the commands that validate; undefined elsewhere. */
  readonly work?: WorkFacts | undefined;
}

export interface Check {
  readonly id: string;
  readonly ok: boolean;
  readonly why?: string | undefined;
  /** The refusal rule a failed check answers with; `policy/validation-failed` when absent. */
  readonly rule?: string | undefined;
  /** What to do instead, for the refusal. */
  readonly instead?: string | undefined;
}

/** One instance of a collection: its two-digit number and its own requirements. */
export interface Instance {
  readonly nn: string;
  /** Node or instance ids required on top of the collection's `requires`. */
  readonly requires: readonly string[];
}

/**
 * The files whose path and bytes form the hash, the committed code tree, a
 * tree hash the use case computed (a part's, for the step kinds), or nothing (T1).
 */
export type Inputs =
  | { readonly files: readonly string[] }
  | { readonly codeTree: true }
  | { readonly tree: string }
  | { readonly none: true };

/** How a node of the kind becomes done (`kernel-pipeline`, Artifact kinds). */
export type DoneBy =
  | { readonly through: "done" }
  | { readonly through: "construction" }
  | { readonly through: "gate" }
  /** `{nn}` in `command` stands for the instance number. */
  | { readonly through: "command"; readonly command: string }
  /** The latest fresh evidence manifest covering the instance's part; `command` records it. */
  | { readonly through: "evidence"; readonly command: string };

/** The node a validator checks: its id, its instance number and its expanded requirements. */
export interface ValidateTarget {
  readonly id: string;
  readonly nn?: string | undefined;
  /** Requirement ids after expansion, as the graph computed them; absent outside a graph. */
  readonly requires?: readonly string[] | undefined;
}

export interface Kind {
  readonly name: string;
  readonly doneBy: DoneBy;
  /** Only instanced kinds have it: the instances of a collection node, in id order. */
  instances?(view: ChangeView): readonly Instance[];
  /** Only kinds with a content rule have it: why the kind does not apply to this Change, or undefined when it does. */
  skip?(view: ChangeView): string | undefined;
  /** The paths the kind writes, relative to the Change directory; patterns before an instance exists. */
  writes(view: ChangeView, nn?: string): readonly string[];
  inputs(view: ChangeView, nn?: string): Inputs;
  /**
   * Only kinds done through evidence have it: the latest manifest of the kind
   * covering part `nn`, or undefined when none does.
   */
  evidence?(view: ChangeView, nn: string): EvidenceFacts | undefined;
  /** Every check of the validator, passing or not. */
  validate(view: ChangeView, target: ValidateTarget): Check[];
}

export type KindRegistry = ReadonlyMap<string, Kind>;

/** The shared defaults: applies always, done through `bdk done`. */
export abstract class BaseKind implements Kind {
  abstract readonly name: string;
  readonly doneBy: DoneBy = { through: "done" };
  abstract writes(view: ChangeView, nn?: string): readonly string[];
  abstract inputs(view: ChangeView, nn?: string): Inputs;
  abstract validate(view: ChangeView, target: ValidateTarget): Check[];
}

/** The baseline checks of one file: present, not blank, valid against its schema. */
export function fileChecks(view: ChangeView, path: string): Check[] {
  const file = view.file(path);
  if (file === undefined) return [{ id: "exists", ok: false, why: `${path} is missing` }];
  return [
    { id: "exists", ok: true },
    file.blank
      ? { id: "non-empty", ok: false, why: `${path} has no content` }
      : { id: "non-empty", ok: true },
    file.invalid === undefined
      ? { id: "schema", ok: true }
      : { id: "schema", ok: false, why: file.invalid },
  ];
}

const PART_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** The part files of a directory as `nn -> path`, in id order. */
export function partFiles(view: ChangeView, dir: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const name of view.list(dir)) {
    const nn = PART_FILE.exec(name)?.[1];
    if (nn !== undefined && !parts.has(nn)) parts.set(nn, `${dir}/${name}`);
  }
  return parts;
}

/** Neither resolved nor superseded. */
export function live(entry: GraphEntry): boolean {
  return entry.status === "proposed" || entry.status === "accepted";
}
