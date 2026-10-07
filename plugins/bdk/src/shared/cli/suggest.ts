// "Did you mean" for an unknown group or verb (spec `bdk-cli`, "Invocation and routing").

/** Edit distance where swapping two neighbouring letters costs one (optimal string alignment). */
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => rows[i]?.[j] ?? Infinity;
  for (let i = 1; i <= a.length; i++) {
    const row = rows[i] ?? [];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/** The closest name, if it is close enough to be a typo of `input`. */
export function closest(input: string, names: readonly string[]): string | undefined {
  const limit = Math.max(1, Math.floor(input.length / 3));
  let best: { name: string; cost: number } | undefined;
  for (const name of names) {
    const cost = distance(input, name);
    if (cost <= limit && (best === undefined || cost < best.cost)) best = { name, cost };
  }
  return best?.name;
}
