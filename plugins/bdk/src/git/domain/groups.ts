// Reviewer groups of a range (spec `bdk-cli/git`, "Review groups"; design D5).

import { byCodeUnit, pack, tolerance } from "./pack.ts";
import type { Part } from "./plan.ts";

export type GroupKind = "part" | "unplanned" | "module" | "integration";

export interface ReviewGroup {
  readonly id: string;
  readonly kind: GroupKind;
  readonly part?: string;
  readonly files: string[];
}

/** A part or `unplanned` group, split by module with suffixes when above the tolerance. */
function split(
  id: string,
  base: Omit<ReviewGroup, "id" | "files">,
  files: string[],
  target: number,
): ReviewGroup[] {
  if (files.length === 0) return [];
  if (files.length <= tolerance(target)) return [{ id, ...base, files }];
  return pack(files, target).map((group, i) => ({ id: `${id}-${i + 1}`, ...base, files: group }));
}

/**
 * The groups of the changed text files: by plan part when `parts` is given, by module
 * otherwise, then `integration` with every file. No file, no group.
 */
export function reviewGroups(
  changed: readonly string[],
  parts: readonly Part[] | undefined,
  target: number,
): ReviewGroup[] {
  const files = [...changed].sort(byCodeUnit);
  if (files.length === 0) return [];
  const groups: ReviewGroup[] = [];
  if (parts === undefined) {
    pack(files, target).forEach((group, i) => {
      groups.push({ id: `m${i + 1}`, kind: "module", files: group });
    });
  } else {
    const claimed = new Set<string>();
    for (const part of parts) {
      const listed = new Set(part.files);
      const mine = files.filter((file) => listed.has(file) && !claimed.has(file));
      mine.forEach((file) => claimed.add(file));
      groups.push(...split(`p${part.id}`, { kind: "part", part: part.id }, mine, target));
    }
    const unplanned = files.filter((file) => !claimed.has(file));
    groups.push(...split("unplanned", { kind: "unplanned" }, unplanned, target));
  }
  groups.push({ id: "integration", kind: "integration", files });
  return groups;
}
