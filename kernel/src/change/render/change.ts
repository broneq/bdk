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
  lines.push(...renderNodes(report.nodes), ...renderGates(report.gates));
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

/** Pending entries shown per gate; the rest are counted, `bdk log list` shows them. */
const PENDING_SHOWN = 5;

type StatusNode = StatusReport["nodes"][number];

/** One line per node; a run of done instances of one kind collapses into one line. */
function renderNodes(nodes: readonly StatusNode[]): string[] {
  if (nodes.length === 0) return [];
  const lines = ["nodes:"];
  for (let i = 0; i < nodes.length;) {
    const node = nodes[i];
    if (node === undefined) break;
    let end = i + 1;
    if (isDoneInstance(node)) {
      while (end < nodes.length && isDoneInstance(nodes[end]) && nodes[end]?.kind === node.kind)
        end += 1;
    }
    const last = nodes[end - 1];
    if (end - i > 1 && last !== undefined) {
      lines.push(`  ${node.id}..${last.id.split(":")[1] ?? ""} done (${String(end - i)})`);
    } else {
      const why = node.state === "done" || node.why === undefined ? "" : `: ${node.why}`;
      lines.push(`  ${node.id} ${node.state}${why}`);
    }
    i = end;
  }
  return lines;
}

function isDoneInstance(node: StatusNode | undefined): boolean {
  return node?.state === "done" && node.kind !== "gate" && node.id.includes(":");
}

function renderGates(gates: StatusReport["gates"]): string[] {
  const lines: string[] = [];
  for (const gate of gates) {
    const state = gate.done
      ? `passed by ${gate.passedBy ?? "user"}`
      : gate.ready
        ? `ready, the user passes it with ${gate.command ?? "its stage command"}`
        : "not ready";
    lines.push(`${gate.gate}: ${state}`);
    if (gate.done) continue;
    for (const entry of gate.pending.slice(0, PENDING_SHOWN)) {
      lines.push(`  pending ${entry.id} ${entry.type}: ${entry.summary}`);
    }
    const more = gate.pending.length - PENDING_SHOWN;
    if (more > 0) lines.push(`  ${String(more)} more pending: bdk log list`);
  }
  return lines;
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
