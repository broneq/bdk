// The text of `bdk run status`, written for a model reading a Bash result: one line per Change,
// one per part, no table wider than its content.

import type { StatusResult } from "../schema/status.ts";

type Change = StatusResult["changes"][number];

function where(change: Change): string {
  if (change.row === null) return change.stage;
  const step = change.step === null ? "" : ` ${change.step}`;
  const round = change.round === null ? "" : `, round ${String(change.round)}`;
  return `${change.stage}${step} (row ${String(change.row)}${round})`;
}

export function renderStatus(result: StatusResult): string {
  const index = result.changes.findIndex((change) => change.current);
  const lines = [
    `run: ${result.mode}, current ${result.current} (${String(index + 1)} of ${String(result.changes.length)})`,
    "changes:",
  ];
  const label = (change: Change): string =>
    change.issue === null ? change.change : `${change.change} #${String(change.issue)}`;
  const width = Math.max(...result.changes.map((change) => label(change).length));
  for (const change of result.changes) {
    const mark = change.current ? "*" : " ";
    lines.push(`${mark} ${label(change).padEnd(width)}  ${where(change)}: ${change.reason}`);
  }
  lines.push(`parts of ${result.current}:${result.parts.length === 0 ? " none" : ""}`);
  const statusWidth = Math.max(0, ...result.parts.map((part) => part.status.length));
  for (const part of result.parts) {
    const reason = part.reason === null ? "" : `  ${part.reason}`;
    lines.push(
      `  ${part.id}  ${part.status.padEnd(statusWidth)}  attempts ${String(part.attempts)}${reason}`,
    );
  }
  if (result.warnings.length > 0) {
    lines.push("warnings:");
    for (const warning of result.warnings) lines.push(`  ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}
