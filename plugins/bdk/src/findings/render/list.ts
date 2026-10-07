// The text form of `bdk findings list`, for a model reading a Bash result (design D4).
import { countsLine } from "../domain/counts.ts";
import type { Finding } from "../domain/fold.ts";
import type { ListResult } from "../schema/list.ts";

export interface ListFilters {
  readonly level?: string | undefined;
  readonly decision?: string | undefined;
}

function where({ file, line, rule }: Finding): string {
  const place = file === undefined ? "-" : line === undefined ? file : `${file}:${line}`;
  return rule === undefined ? place : `${place} [${rule}]`;
}

function row(finding: Finding): string[] {
  const decision =
    finding.decision === null
      ? "-"
      : finding.issue === undefined
        ? finding.decision
        : `${finding.decision} ${finding.issue}`;
  const notes: [string, string | undefined][] = [
    ["evidence", finding.evidence],
    ["level reason", finding.levelReason],
    ["decision reason", finding.decisionReason],
  ];
  return [
    [
      finding.id,
      finding.level ?? "-",
      decision,
      where(finding),
      finding.summary,
      `(${finding.sources.join(", ")})`,
    ].join("  "),
    ...notes.flatMap(([name, text]) =>
      text === undefined ? [] : [`  ${name}: ${text.replaceAll("\n", "\n    ")}`],
    ),
  ];
}

export function renderList(
  { findings, counts, skipped }: ListResult,
  filters: ListFilters,
): string {
  const lines = [countsLine(counts)];
  const flags = Object.entries(filters).flatMap(([name, value]) =>
    value === undefined ? [] : [`--${name} ${value}`],
  );
  if (flags.length > 0) lines.push(`${findings.length} listed (${flags.join(" ")}).`);
  if (findings.length > 0) lines.push("", ...findings.flatMap(row));
  if (skipped.length > 0) {
    lines.push("", ...skipped.map(({ line, reason }) => `Skipped line ${line}: ${reason}`));
  }
  return lines.join("\n");
}
