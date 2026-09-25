// The "did you mean" hint of `kernel-settings`, Registry and consumers: the
// declared key closest to an unknown one, within edit distance 2.

const MAX_DISTANCE = 2;

export function closest(key: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = MAX_DISTANCE + 1;
  for (const candidate of candidates) {
    const distance = editDistance(key, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Optimal string alignment distance: Levenshtein plus adjacent transpositions. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => d[i]?.[j] ?? 0;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, at(i - 2, j - 2) + 1);
      }
      const row = d[i];
      if (row !== undefined) row[j] = value;
    }
  }
  return at(a.length, b.length);
}
