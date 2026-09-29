// The difference rule of the harness (design D-7, T03 D-7): a gap between
// two cells counts only when their medians are further apart than the larger
// within-cell range, so an A/A pair's spread is the noise floor.

/** Values closer than this are equal: cell values are sums of fractions. */
const EPSILON = 1e-9;

function sorted(values: readonly number[]): number[] {
  if (values.length === 0) throw new Error("median of an empty cell");
  return [...values].sort((a, b) => a - b);
}

function at(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) throw new Error(`no value at index ${String(index)}`);
  return value;
}

export function median(values: readonly number[]): number {
  const ordered = sorted(values);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return at(ordered, middle);
  return (at(ordered, middle - 1) + at(ordered, middle)) / 2;
}

export function range(values: readonly number[]): number {
  const ordered = sorted(values);
  return at(ordered, ordered.length - 1) - at(ordered, 0);
}

export interface Comparison {
  /** `a` or `b` names the cell with the higher median when the gap is measurable. */
  readonly verdict: "no-difference" | "a" | "b";
  readonly medianA: number;
  readonly medianB: number;
  readonly gap: number;
  /** The larger within-cell range of the two cells. */
  readonly noise: number;
}

export function compare(a: readonly number[], b: readonly number[]): Comparison {
  if (a.length < 2 || b.length < 2) throw new Error("a comparison needs at least 2 runs per cell");
  const medianA = median(a);
  const medianB = median(b);
  const gap = Math.abs(medianA - medianB);
  const noise = Math.max(range(a), range(b));
  const measurable = gap > noise + EPSILON;
  const verdict = !measurable ? "no-difference" : medianA > medianB ? "a" : "b";
  return { verdict, medianA, medianB, gap, noise };
}
