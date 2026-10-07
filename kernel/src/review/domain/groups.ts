// The reviewer groups of a review round (`kernel-cli/review`, bdk review
// plan; T42-R1): the logical group first, the size limit second. Pure, so the
// same changed files and plan give the same groups.

type GroupKind = "part" | "unplanned" | "module" | "integration";

export interface ReviewGroup {
  readonly id: string;
  readonly kind: GroupKind;
  /** Only on a `part` group: the plan part number. */
  readonly part?: string | undefined;
  readonly files: readonly string[];
}

/** A plan part and the paths its tasks' `Files:` name. */
export interface PartFiles {
  readonly id: string;
  readonly files: readonly string[];
}

export interface GroupInput {
  /** The changed files of the range, `.bdk/` excluded. */
  readonly changed: readonly string[];
  /** The changed files git counts as binary: no reviewer reads them, so they go into no group (#158). */
  readonly binary: readonly string[];
  /** The plan parts in plan order; none groups by module. */
  readonly parts: readonly PartFiles[];
  /** `review.group.max-files`: the target size of a group; a module or part is kept whole up to a third above it. */
  readonly maxFiles: number;
  /** The module of a path, as `bdk measure` counts it. */
  readonly moduleOf: (path: string) => string;
}

const UNPLANNED = "unplanned";
const INTEGRATION = "integration";

export function reviewGroups(input: GroupInput): ReviewGroup[] {
  const binary = new Set(input.binary);
  const changed = sorted(new Set(input.changed.filter((path) => !binary.has(path))));
  if (changed.length === 0) return [];
  const logical = input.parts.length > 0 ? byPart(changed, input.parts) : byModule(changed, input);
  return [
    ...logical.flatMap((group) => split(group, input)),
    { id: INTEGRATION, kind: "integration", files: changed },
  ];
}

/** One group per part with changed files, a file going to the first part naming it, then `unplanned`. */
function byPart(changed: readonly string[], parts: readonly PartFiles[]): ReviewGroup[] {
  const owned = new Map<string, string[]>();
  const unplanned: string[] = [];
  for (const path of changed) {
    const owner = parts.find((part) => part.files.includes(path));
    if (owner === undefined) unplanned.push(path);
    else owned.set(owner.id, [...(owned.get(owner.id) ?? []), path]);
  }
  const groups: ReviewGroup[] = parts.flatMap((part) => {
    const files = owned.get(part.id);
    return files === undefined ? [] : [{ id: `p${part.id}`, kind: "part", part: part.id, files }];
  });
  return unplanned.length === 0
    ? groups
    : [...groups, { id: UNPLANNED, kind: "unplanned", files: unplanned }];
}

/** Modules packed into groups of about `max-files`, numbered from 1. */
function byModule(changed: readonly string[], input: GroupInput): ReviewGroup[] {
  return pack(changed, input).map((files, at) => ({
    id: `m${String(at + 1)}`,
    kind: "module",
    files,
  }));
}

/** A group above the tolerance is packed again; a smaller one stays whole. */
function split(group: ReviewGroup, input: GroupInput): ReviewGroup[] {
  if (group.files.length <= tolerance(input.maxFiles)) return [group];
  return pack(group.files, input).map((files, at) => ({
    ...group,
    id: `${group.id}-${String(at + 1)}`,
    files,
  }));
}

/** A module or part up to a third above `max-files` is kept whole rather than cut. */
function tolerance(maxFiles: number): number {
  return Math.floor((maxFiles * 4) / 3);
}

/**
 * Whole modules, in path order, fill a chunk until the next would pass
 * `max-files`. A module above the tolerance is cut by its next directory
 * level, and only files with no directory left below them are cut into runs.
 */
function pack(paths: readonly string[], input: GroupInput): string[][] {
  return packUnits(
    [...modules(paths, input.moduleOf)],
    input,
    (module) => module.split("/").length,
  );
}

function packUnits(
  units: readonly (readonly [string, string[]])[],
  input: GroupInput,
  depthOf: (key: string) => number,
): string[][] {
  const limit = tolerance(input.maxFiles);
  const chunks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = [];
  };
  for (const [key, files] of units) {
    if (files.length > limit) {
      flush();
      chunks.push(...cut(files, depthOf(key), input));
    } else {
      if (current.length + files.length > input.maxFiles) flush();
      current = [...current, ...files];
    }
  }
  flush();
  return chunks;
}

/** An oversized module by the directory below `depth`; its own files in even runs. */
function cut(files: string[], depth: number, input: GroupInput): string[][] {
  const below = new Map<string, string[]>();
  for (const path of files) {
    const segments = path.split("/");
    const key = segments.length > depth + 1 ? (segments[depth] ?? "") : ".";
    below.set(key, [...(below.get(key) ?? []), path]);
  }
  if (below.size === 1 && below.has(".")) return runs(files, input.maxFiles);
  return packUnits([...below], input, () => depth + 1);
}

/** Even runs of at most `size` files, so no run is a stub. */
function runs(files: readonly string[], size: number): string[][] {
  const count = Math.ceil(files.length / size);
  const each = Math.ceil(files.length / count);
  return Array.from({ length: count }, (_, at) => files.slice(at * each, (at + 1) * each));
}

/** Sorted paths by module, modules in sorted order. */
function modules(
  paths: readonly string[],
  moduleOf: (path: string) => string,
): Map<string, string[]> {
  const byModule = new Map<string, string[]>();
  for (const path of sorted(paths)) {
    const module = moduleOf(path);
    byModule.set(module, [...(byModule.get(module) ?? []), path]);
  }
  return new Map(sorted(byModule.keys()).map((module) => [module, byModule.get(module) ?? []]));
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
