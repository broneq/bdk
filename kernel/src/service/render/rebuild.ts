import type { RebuildReport } from "../domain/report.ts";

function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${String(n)} ${n === 1 ? noun : plural}`;
}

export function renderRebuild(report: RebuildReport): string {
  const lines = [
    `rebuilt ${count(report.changes, "Change")}: ${count(report.entries, "entry", "entries")}, ${count(report.attempts, "attempt")}, ${count(report.commits, "commit")} in ${String(report.durationMs)} ms`,
    ...report.migrated.map((path) => `migrated ${path}`),
    ...report.warnings.map((warning) => `warning: ${warning}`),
  ];
  return `${lines.join("\n")}\n`;
}
