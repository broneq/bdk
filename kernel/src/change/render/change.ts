// Text renderings of the change commands (`kernel-cli`, Output modes).
import type {
  CheckpointReport,
  CloseReport,
  ListItem,
  NewReport,
  ParkReport,
  ResumeReport,
  StatusReport,
  TakeoverReport,
} from "../domain/change.ts";

/** Open tickets the status text lists; `attempt list` pages the rest. */
const TICKETS_SHOWN = 20;

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
  if (report.parts.length > 0) {
    lines.push("parts:");
    for (const part of report.parts) {
      lines.push(
        `  ${part.part} ${part.title}: ${part.state}, ${String(part.done ?? 0)}/${String(part.tasks)} tasks`,
      );
    }
  }
  if (report.parked !== undefined) {
    lines.push(`parked on ${report.parked.entry}; options:`);
    report.parked.options.forEach((option, i) => lines.push(`  ${String(i + 1)}. ${option}`));
    lines.push(`resume: ${report.parked.resume}`);
  }
  for (const ticket of report.openTickets.slice(0, TICKETS_SHOWN)) {
    lines.push(
      `open ticket ${ticket.ticket}: ${ticket.loop} ${ticket.target} attempt ${String(ticket.attempt)}/${String(ticket.of)}`,
    );
  }
  const more = report.openTickets.length - TICKETS_SHOWN;
  if (more > 0) lines.push(`... ${String(more)} more open tickets (bdk attempt list)`);
  for (const truncated of report.rulesTruncated.slice(0, TICKETS_SHOWN)) {
    lines.push(
      `rules truncated: ${truncated.ticket} (${truncated.role}, ${truncated.target}) dropped ${String(truncated.count)} rules at rules.max-per-package`,
    );
  }
  const hidden = report.rulesTruncated.length - TICKETS_SHOWN;
  if (hidden > 0) lines.push(`... ${String(hidden)} more tickets with truncated rules (--json)`);
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

export function renderCheckpoint(report: CheckpointReport): string {
  return report.done
    ? `checkpoint of ${report.change}: ${report.commit ?? ""}\n`
    : `checkpoint of ${report.change} skipped: ${report.skipped ?? ""}\n`;
}

export function renderTakeover(report: TakeoverReport): string {
  return `took over ${report.change}: closed ${report.closedTickets.join(", ")} as not-run, state rebuilt\n`;
}

export function renderClose(report: CloseReport, dryRun: boolean): string {
  const merged = report.spec.unchanged
    ? "no spec change"
    : `specs ${report.spec.merged.join(", ")}`;
  const head = dryRun
    ? `would close ${report.change}: ${merged}, archive to ${report.archivedTo}`
    : `closed ${report.change}: ${merged}, archived to ${report.archivedTo}`;
  const policy =
    report.gatesByPolicy.length === 0
      ? []
      : [`passed by policy: ${report.gatesByPolicy.join(", ")}`];
  return `${[head, ...policy].join("\n")}\n\n${report.summary}`;
}
