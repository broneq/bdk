// Text renderings of the change commands (`kernel-cli`, Output modes).
import type {
  ListItem,
  NewReport,
  ParkReport,
  ResumeReport,
  StatusReport,
} from "../domain/change.ts";

export function renderNew(report: NewReport): string {
  const how = report.profile.defaulted ? "default" : "set by the caller";
  const lines = [
    `opened ${report.change} on ${report.branch} (${report.kind}, ${report.source})`,
    `profile ${report.profile.value} (${how}), recorded as ${report.profile.entry}`,
  ];
  if (report.overriddenKeys.length > 0) {
    lines.push(`overridden by global or local: ${report.overriddenKeys.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderStatus(report: StatusReport): string {
  const intent = report.confirmed ? report.source : `${report.source}, unconfirmed`;
  const lines = [
    `${report.change} (${report.kind}, ${intent})`,
    `stage: ${report.stage}`,
    `profile: ${report.profile}`,
  ];
  if (report.parked !== undefined) {
    lines.push(`parked on ${report.parked.entry}; options:`);
    report.parked.options.forEach((option, i) => lines.push(`  ${String(i + 1)}. ${option}`));
    lines.push(`resume: ${report.parked.resume}`);
  }
  for (const ticket of report.openTickets) {
    lines.push(
      `open ticket ${ticket.ticket}: ${ticket.loop} ${ticket.target} attempt ${String(ticket.attempt)}/${String(ticket.of)}`,
    );
  }
  if (report.overriddenKeys.length > 0) {
    lines.push(`overridden by global or local: ${report.overriddenKeys.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderList(items: readonly ListItem[]): string {
  if (items.length === 0) return "no Changes\n";
  const lines = items.map((item) => {
    const branch = item.branch ?? "no branch";
    return `${item.change} ${item.state} ${item.stage} (${branch}, ${item.kind}, ${item.profile}, ${item.updatedAt})`;
  });
  return `${lines.join("\n")}\n`;
}

export function renderResume(report: ResumeReport): string {
  const from = report.resumedFrom === undefined ? "" : ` from ${report.resumedFrom}`;
  const decision = report.decision === undefined ? "" : `, decision ${report.decision}`;
  return `resumed ${report.change} on ${report.branch}${from} (stage ${report.stage}${decision})\n`;
}

export function renderPark(report: ParkReport): string {
  const lines = [`parked ${report.change} on ${report.entry}; options:`];
  report.options.forEach((option, i) => lines.push(`  ${String(i + 1)}. ${option}`));
  lines.push(`resume: ${report.resume}`);
  lines.push(
    report.checkpoint.done
      ? `checkpoint: ${report.checkpoint.commit ?? "done"}`
      : `checkpoint skipped: ${report.checkpoint.skipped ?? "not run"}`,
  );
  return `${lines.join("\n")}\n`;
}
