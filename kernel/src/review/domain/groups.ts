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
  /** The plan parts in plan order; none groups by module. */
  readonly parts: readonly PartFiles[];
  /** `review.group.max-files`: a group above it is split. */
  readonly maxFiles: number;
  /** The module of a path, as `bdk measure` counts it. */
  readonly moduleOf: (path: string) => string;
}

const UNPLANNED = "unplanned";
const INTEGRATION = "integration";

export function reviewGroups(input: GroupInput): ReviewGroup[] {
  const changed = sorted(new Set(input.changed));
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

/** One group per module, in module order, numbered from 1. */
function byModule(changed: readonly string[], input: GroupInput): ReviewGroup[] {
  return [...modules(changed, input.moduleOf).values()].map((files, at) => ({
    id: `m${String(at + 1)}`,
    kind: "module",
    files,
  }));
}

/**
 * A group above the limit: modules in order fill a chunk until the next would
 * pass it, a module above the limit alone is cut into runs of sorted paths.
 */
function split(group: ReviewGroup, input: GroupInput): ReviewGroup[] {
  if (group.files.length <= input.maxFiles) return [group];
  const chunks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = [];
  };
  for (const files of modules(group.files, input.moduleOf).values()) {
    if (files.length > input.maxFiles) {
      flush();
      for (let at = 0; at < files.length; at += input.maxFiles) {
        chunks.push(files.slice(at, at + input.maxFiles));
      }
    } else {
      if (current.length + files.length > input.maxFiles) flush();
      current = [...current, ...files];
    }
  }
  flush();
  return chunks.map((files, at) => ({ ...group, id: `${group.id}-${String(at + 1)}`, files }));
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
