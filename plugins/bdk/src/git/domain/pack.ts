// Module packing of reviewer groups (spec `bdk-cli/git`, "Review groups"; design D5).

/** Code-unit order, independent of the locale. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function directories(path: string): string[] {
  return path.split("/").slice(0, -1);
}

/** The first two directory segments of a path, or `.` for a file at the repository root. */
export function moduleOf(path: string): string {
  const dirs = directories(path).slice(0, 2);
  return dirs.length === 0 ? "." : dirs.join("/");
}

/** The size up to which a module or a part is never cut. */
export function tolerance(target: number): number {
  return Math.max(1, Math.floor((target * 4) / 3));
}

/** Sorted files cut into the fewest even runs of at most `target`. */
function evenRuns(files: readonly string[], target: number): string[][] {
  if (files.length === 0) return [];
  const count = Math.ceil(files.length / target);
  const runs: string[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.floor(files.length / count) + (i < files.length % count ? 1 : 0);
    runs.push(files.slice(start, start + size));
    start += size;
  }
  return runs;
}

/**
 * Sorted files cut into units of at most the tolerance: the directories at `depth` segments,
 * a directory above the tolerance cut by its next level, its own files into even runs.
 */
function units(files: readonly string[], depth: number, target: number): string[][] {
  const buckets = new Map<string, string[]>();
  for (const file of files) {
    const key = directories(file).slice(0, depth).join("/");
    buckets.set(key, [...(buckets.get(key) ?? []), file]);
  }
  return [...buckets.keys()].sort(byCodeUnit).flatMap((key) => {
    const bucket = buckets.get(key) ?? [];
    if (bucket.length <= tolerance(target)) return [bucket];
    const direct = bucket.filter((file) => directories(file).length <= depth);
    const deeper = bucket.filter((file) => directories(file).length > depth);
    return [...evenRuns(direct, target), ...units(deeper, depth + 1, target)];
  });
}

/** Files packed into groups by module: units in order fill a group up to `target`. */
export function pack(files: readonly string[], target: number): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const unit of units([...files].sort(byCodeUnit), 2, target)) {
    if (current.length > 0 && current.length + unit.length > target) {
      groups.push(current);
      current = [];
    }
    current = [...current, ...unit];
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
