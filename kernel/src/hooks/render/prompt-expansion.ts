// The text `prompt-expansion` prints on a pass, which the host adds to the
// expanded skill's context (`kernel-cli/hooks`, Hook payloads): the gate
// status, what passed it and the pending `review: true` entries.
import type { GateSummary, PromptExpansionReport } from "../domain/report.ts";

export function renderPromptExpansion(report: PromptExpansionReport): string {
  if (report.run !== undefined && report.passed === undefined) {
    return `[BDK] run started${report.run.auto ? " with --auto" : ""} for the intent; no Change is active yet.`;
  }
  if (report.passed !== undefined) return runLines(report).join("\n");
  if (report.stage === undefined) return "";
  if (report.status === undefined) {
    const flag = report.skipVerify === true ? " with --skip-verify" : "";
    return report.entry === undefined
      ? `[BDK] stage ${report.stage}${flag} is already recorded.`
      : `[BDK] stage ${report.stage}${flag} recorded in ${report.entry}.`;
  }
  const head =
    report.entry === undefined
      ? `[BDK] ${report.status.gate} was already passed by ${report.status.passedBy ?? "the user"}${report.passedAt === undefined ? "" : ` at ${report.passedAt}`}; nothing was written.`
      : `[BDK] ${report.status.gate} passed by the user in ${report.entry}; stage ${report.stage} is open.`;
  return [head, ...pendingLines(report.status)].join("\n");
}

function runLines(report: PromptExpansionReport): string[] {
  const passed = (report.passed ?? []).map(
    (pass) => `[BDK] ${pass.gate} passed by policy in ${pass.entry}; stage ${pass.stage} is open.`,
  );
  const waiting = (report.waiting ?? []).flatMap((gate) => [
    `[BDK] ${gate.gate} is ready; the user types ${gate.command ?? "its stage command"} to pass it.`,
    ...pendingLines(gate),
  ]);
  const lines = [...passed, ...waiting];
  return lines.length > 0 ? lines : ["[BDK] no gate is ready to pass."];
}

function pendingLines(gate: GateSummary): string[] {
  return gate.pending.map(
    (entry) => `[BDK] pending review: ${entry.id} ${entry.type}: ${entry.summary}`,
  );
}
