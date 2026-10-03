// The coverage verdict of `bdk evidence coverage` (`kernel-cli/evidence`; T42
// D5): an lcov or Cobertura report parsed into hit counts per line, measured
// over the lines a Change adds. The kernel decides the verdict from these
// numbers, so a runner cannot pass a threshold it missed.
export type CoverageFormat = "lcov" | "cobertura";

/** Hit counts per 1-based line, by the path the report names. */
export type CoverageReport = ReadonlyMap<string, ReadonlyMap<number, number>>;

interface FileCoverage {
  readonly path: string;
  readonly covered: number;
  readonly total: number;
  /** The added, instrumented lines without a hit. */
  readonly uncovered: readonly number[];
}

/** The summary file a coverage manifest records and cites at `#/percent`. */
export interface CoverageSummary {
  readonly test: string;
  readonly format: CoverageFormat;
  readonly min: number | null;
  /** Rounded down to one decimal; null when no added line is instrumented. */
  readonly percent: number | null;
  readonly covered: number;
  readonly total: number;
  readonly files: readonly FileCoverage[];
  /** Changed executable files the report does not name; they are not in `total`. */
  readonly unmeasured: readonly string[];
}

export function parseCoverage(
  format: CoverageFormat,
  text: string,
): CoverageReport | { readonly problem: string } {
  return format === "lcov" ? parseLcov(text) : parseCobertura(text);
}

function parseLcov(text: string): CoverageReport | { readonly problem: string } {
  const report = new Map<string, Map<number, number>>();
  const lines = text.split(/\r?\n/);
  const bad = (at: number) => ({
    problem: `not an lcov report: line ${String(at + 1)}: ${lines[at] ?? ""}`,
  });
  let file: Map<number, number> | undefined;
  for (const [at, line] of lines.entries()) {
    if (line.trim() === "" || line === "end_of_record") continue;
    if (line.startsWith("SF:")) {
      const path = line.slice(3);
      file = report.get(path) ?? new Map<number, number>();
      report.set(path, file);
      continue;
    }
    if (line.startsWith("DA:")) {
      const record = /^DA:(\d+),(\d+)(?:,.*)?$/.exec(line);
      if (record === null || file === undefined) return bad(at);
      hit(file, Number(record[1]), Number(record[2]));
      continue;
    }
    if (!/^[A-Z]+:/.test(line)) return bad(at);
  }
  if (report.size === 0) return bad(lines.findIndex((line) => line.trim() !== ""));
  return report;
}

const TAG = /<(\/?)(coverage|class|line)\b([^>]*)>/g;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;

function parseCobertura(text: string): CoverageReport | { readonly problem: string } {
  const lines = text.split(/\r?\n/);
  const lineAt = (offset: number) => text.slice(0, offset).split("\n").length - 1;
  const bad = (at: number) => ({
    problem: `not a cobertura report: line ${String(at + 1)}: ${(lines[at] ?? "").trim()}`,
  });
  const report = new Map<string, Map<number, number>>();
  let root = false;
  let file: Map<number, number> | undefined;
  for (const tag of text.matchAll(TAG)) {
    const [, closing, name, rest = ""] = tag;
    if (name === "coverage") {
      root ||= closing === "";
      continue;
    }
    if (!root) break;
    if (name === "class") {
      const path = closing === "" ? attributes(rest).get("filename") : undefined;
      file = path === undefined ? undefined : (report.get(path) ?? new Map<number, number>());
      if (path !== undefined && file !== undefined) report.set(path, file);
      if (closing === "" && rest.trimEnd().endsWith("/")) file = undefined;
      continue;
    }
    if (closing !== "" || file === undefined) continue;
    const values = attributes(rest);
    const number = values.get("number") ?? "";
    const hits = values.get("hits") ?? "";
    if (!/^\d+$/.test(number) || !/^\d+$/.test(hits)) return bad(lineAt(tag.index));
    hit(file, Number(number), Number(hits));
  }
  if (!root) {
    const first = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !/^<(\?xml|!DOCTYPE|!--)/.test(trimmed);
    });
    return bad(Math.max(first, 0));
  }
  return report;
}

function attributes(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(ATTRIBUTE)].map(([, key = "", value = ""]) => [key, decodeEntities(value)]),
  );
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (whole, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code] ?? whole;
  });
}

/** A line listed twice keeps its highest count. */
function hit(file: Map<number, number>, line: number, hits: number): void {
  file.set(line, Math.max(file.get(line) ?? 0, hits));
}

export interface CoverageInput {
  readonly test: string;
  readonly format: CoverageFormat;
  readonly min?: number | undefined;
  /** The lines the Change adds, by repository-relative path, executable files only. */
  readonly added: ReadonlyMap<string, readonly number[]>;
  readonly report: CoverageReport;
  /** An absolute report path is made relative to it. */
  readonly projectRoot: string;
}

export function measureCoverage(input: CoverageInput): CoverageSummary {
  const mapped = mapReportPaths(input);
  const files: FileCoverage[] = [];
  const unmeasured: string[] = [];
  for (const [path, added] of [...input.added.entries()].sort(([a], [b]) => byteOrder(a, b))) {
    const hits = mapped.get(path);
    if (hits === undefined) {
      unmeasured.push(path);
      continue;
    }
    const instrumented = added.filter((line) => hits.has(line));
    const uncovered = instrumented.filter((line) => (hits.get(line) ?? 0) === 0);
    files.push({
      path,
      covered: instrumented.length - uncovered.length,
      total: instrumented.length,
      uncovered,
    });
  }
  const covered = files.reduce((sum, file) => sum + file.covered, 0);
  const total = files.reduce((sum, file) => sum + file.total, 0);
  return {
    test: input.test,
    format: input.format,
    min: input.min ?? null,
    percent: total === 0 ? null : Math.floor((covered * 1000) / total) / 10,
    covered,
    total,
    files,
    unmeasured,
  };
}

/** `fail` only when a threshold is set, a line is measured and the percent is below it. */
export function coverageVerdict(summary: CoverageSummary): "pass" | "fail" {
  return summary.min !== null && summary.percent !== null && summary.percent < summary.min
    ? "fail"
    : "pass";
}

/**
 * The hit counts of each changed file: a report path names the changed file
 * it equals, or else the one changed file it is a path-segment suffix of; a
 * suffix two changed files share is ambiguous and names neither. A changed
 * file takes its longest matching report path.
 */
function mapReportPaths(input: CoverageInput): Map<string, ReadonlyMap<number, number>> {
  const changed = [...input.added.keys()];
  const best = new Map<string, string>();
  const byPath = new Map<string, ReadonlyMap<number, number>>();
  for (const [given, hits] of input.report) {
    const path = repositoryPath(given, input.projectRoot);
    byPath.set(path, merged(byPath.get(path), hits));
    const exact = changed.includes(path) ? [path] : [];
    const matches = exact.length > 0 ? exact : changed.filter((file) => file.endsWith(`/${path}`));
    if (matches.length !== 1) continue;
    const [file = ""] = matches;
    if (path.length > (best.get(file)?.length ?? -1)) best.set(file, path);
  }
  return new Map([...best.entries()].map(([file, path]) => [file, byPath.get(path) ?? new Map()]));
}

/** An absolute path under the project root made relative to it; any other path as given. */
function repositoryPath(given: string, projectRoot: string): string {
  const path = given.replaceAll("\\", "/");
  const root = projectRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  const relative = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
  return relative.replace(/^(\.\/)+/, "");
}

function merged(
  a: ReadonlyMap<number, number> | undefined,
  b: ReadonlyMap<number, number>,
): ReadonlyMap<number, number> {
  if (a === undefined) return b;
  const both = new Map(a);
  for (const [line, hits] of b) both.set(line, Math.max(both.get(line) ?? 0, hits));
  return both;
}

function byteOrder(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}
