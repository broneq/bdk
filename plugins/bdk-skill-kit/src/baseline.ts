import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ConfigError } from "./config.ts";
import type { Finding } from "./index.ts";
import { compareFindings } from "./runner.ts";

export interface BaselineEntry {
  rule: string;
  file: string;
  fingerprint: string;
}

export interface BaselineResult {
  /** Findings left after suppression, plus one `baseline-stale` error per stale entry. */
  findings: Finding[];
  suppressed: number;
  /** Entries in scope that matched no finding. */
  stale: BaselineEntry[];
}

const key = (e: BaselineEntry) => `${e.rule}\0${e.file}\0${e.fingerprint}`;

const isEntry = (value: unknown): value is BaselineEntry => {
  if (typeof value !== "object" || value === null) return false;
  const { rule, file, fingerprint } = value as Record<string, unknown>;
  return typeof rule === "string" && typeof file === "string" && typeof fingerprint === "string";
};

/** Reads a baseline; `shown` is the path used in error messages. */
export function readBaseline(path: string, shown: string): BaselineEntry[] {
  if (!existsSync(path)) {
    throw new ConfigError(`baseline \`${shown}\` does not exist; create it with --baseline-init`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed) || !parsed.every(isEntry)) {
    throw new ConfigError(
      `baseline \`${shown}\` must be a JSON array of { rule, file, fingerprint } entries`,
    );
  }
  return parsed.map(({ rule, file, fingerprint }) => ({ rule, file, fingerprint }));
}

/** Writes entries sorted, so a regenerated baseline diffs cleanly. */
export function writeBaseline(path: string, entries: BaselineEntry[]): void {
  const sorted = [...entries].sort((a, b) => key(a).localeCompare(key(b)));
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function entriesOf(findings: Finding[]): BaselineEntry[] {
  return findings.map(({ rule, file, fingerprint }) => ({ rule, file, fingerprint }));
}

/**
 * Suppresses each finding that matches an entry, one finding per entry, and
 * turns every in-scope entry left unmatched into a `baseline-stale` error.
 * Entries outside `inScope` (a run narrowed by path arguments) are never stale.
 */
export function applyBaseline(
  findings: Finding[],
  entries: BaselineEntry[],
  inScope: (file: string) => boolean,
): BaselineResult {
  const pending = new Map<string, BaselineEntry[]>();
  for (const entry of entries) pending.set(key(entry), [...(pending.get(key(entry)) ?? []), entry]);

  const kept: Finding[] = [];
  let suppressed = 0;
  for (const finding of findings) {
    const match = pending.get(key(finding));
    if (match?.pop()) suppressed++;
    else kept.push(finding);
  }

  const stale = [...pending.values()].flat().filter((e) => inScope(e.file));
  for (const entry of stale) {
    kept.push({
      rule: "baseline-stale",
      severity: "error",
      file: entry.file,
      line: 1,
      message: `the baseline entry for \`${entry.rule}\` matches no finding; remove it with --baseline-prune`,
      fingerprint: entry.fingerprint,
    });
  }
  kept.sort(compareFindings);
  return { findings: kept, suppressed, stale };
}
