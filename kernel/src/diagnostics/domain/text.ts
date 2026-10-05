// The counts of a report and one line per finding: the text mode of `bdk
// diagnostics report` and the end of the verbose log (`kernel-cli/diagnostics`).
import type { DiagnosticsReport, Tokens } from "../domain/report.ts";

export function reportText(report: DiagnosticsReport): string {
  const lines = [
    `Session ${report.session}${report.change === null ? "" : `  Change ${report.change}`}${report.stage === null ? "" : `  stage ${report.stage}`}`,
    `${report.from} to ${report.to}  transcript ${report.transcript}${report.unknownLines > 0 ? ` (${String(report.unknownLines)} unknown lines)` : ""}${report.truncated ? "  journal truncated" : ""}`,
    `refusals ${String(report.refusals.total)}${counts(report.refusals.byRule)}`,
    `by role${counts(report.refusals.byRole) || " none"}`,
    `guard blocks ${String(report.guardBlocks)}  retries ${String(report.retries)}  escalations ${String(report.escalations)}  parks ${String(report.parks)}  questions ${String(report.questions)}`,
    `tokens ${total(report.agents.map((agent) => agent.tokens))}  unknown agents ${String(report.tokensUnknownAgents)}  cost ${report.cost === null ? "-" : `$${report.cost.totalUSD.toFixed(2)}`}`,
    `findings ${String(report.anomalies)}`,
    ...report.findings.map(
      (finding) =>
        `! ${finding.detector} ${finding.at} ${finding.agent}${finding.ticket === null ? "" : ` ${finding.ticket}`} ${finding.cite}  ${finding.summary}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function counts(values: Readonly<Record<string, number>>): string {
  return Object.entries(values)
    .sort(([, a], [, b]) => b - a)
    .map(([key, count]) => `  ${key} ${String(count)}`)
    .join("");
}

function total(all: readonly Tokens[]): string {
  let sum = 0;
  for (const tokens of all) {
    if (tokens === null) continue;
    for (const each of Object.values(tokens)) {
      sum += each.input + each.output + each.cacheRead + each.cacheWrite;
    }
  }
  return String(sum);
}
