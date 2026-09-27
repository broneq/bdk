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
  /** The `status` of the report file a `report` entry names, or undefined. */
  reportStatus(entry: GraphEntry): string | undefined;
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

/** The files whose path and bytes form the hash, the committed code tree, or nothing (T1). */
export type Inputs =
  { readonly files: readonly string[] } | { readonly codeTree: true } | { readonly none: true };

/** How a node of the kind becomes done (`kernel-pipeline`, Artifact kinds). */
export type DoneBy =
  | { readonly through: "done" }
  | { readonly through: "construction" }
  | { readonly through: "gate" }
  /** `{nn}` in `command` stands for the instance number. */
  | { readonly through: "command"; readonly command: string };

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
  /** Every check of the validator, passing or not. */
  validate(
    view: ChangeView,
    target: { readonly id: string; readonly nn?: string | undefined },
  ): Check[];
}

export type KindRegistry = ReadonlyMap<string, Kind>;

/** The shared defaults: applies always, done through `bdk done`. */
export abstract class BaseKind implements Kind {
  abstract readonly name: string;
  readonly doneBy: DoneBy = { through: "done" };
  abstract writes(view: ChangeView, nn?: string): readonly string[];
  abstract inputs(view: ChangeView, nn?: string): Inputs;
  abstract validate(
    view: ChangeView,
    target: { readonly id: string; readonly nn?: string | undefined },
  ): Check[];
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

/** Neither resolved, routed nor superseded. */
export function live(entry: GraphEntry): boolean {
  return entry.status === "proposed" || entry.status === "accepted";
}
