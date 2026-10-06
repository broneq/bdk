// Text mode of the rules commands other than `show`: one line per item, the
// list verbs capped at 100 lines by the caller.
import type {
  AcceptReport,
  CheckReport,
  ExplainReport,
  PruneItem,
  StatsReport,
} from "../domain/report.ts";

export function renderCheck(report: CheckReport): string {
  return `rules valid: ${String(report.rules)} (${String(report.bundle)} bundle, ${String(report.project)} project, ${String(report.tombstones)} tombstones)\n`;
}

export function renderExplain(report: ExplainReport): string {
  const lines = [`${report.file} (${report.role})`];
  for (const rule of report.rules) {
    const matched = `matched by ${rule.matchedBy}`;
    lines.push(`- [${rule.id}] ${matched}`);
  }
  if (report.rules.length === 0) lines.push("No rule applies.");
  if (report.disabled.length > 0) lines.push(`disabled: ${report.disabled.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

export function renderPrune(page: { readonly items: readonly PruneItem[] }): string {
  if (page.items.length === 0) return "No rule to prune.\n";
  return `${page.items.map((item) => `${item.id} ${item.reason}: ${item.detail}`).join("\n")}\n`;
}

export function renderAccept(report: AcceptReport): string {
  return `accepted ${report.id}: ${report.path} (origin ${report.origin})\n`;
}

export function renderStats(report: StatsReport): string {
  const lines = [`recurring in at least ${String(report.minChanges)} Changes:`];
  if (report.recurring.length === 0) lines.push("  none");
  for (const item of report.recurring) {
    lines.push(`  ${String(item.changes)} Changes, ${String(item.occurrences)}x: ${item.summary}`);
  }
  if (report.entries !== undefined) {
    lines.push("entries:");
    for (const item of report.entries.items) {
      lines.push(`  ${item.id} ${item.type}${item.adopted ? " (adopted)" : ""}: ${item.summary}`);
    }
    const hidden = report.entries.total - report.entries.items.length;
    if (hidden > 0) lines.push(`  ... ${String(hidden)} more (--all)`);
  }
  const cited = report.citations.filter((citation) => citation.entries > 0);
  lines.push(
    `citations: ${String(cited.length)} of ${String(report.citations.length)} rules cited`,
  );
  for (const citation of cited) {
    lines.push(
      `  ${citation.id}: ${String(citation.entries)} entries in ${String(citation.changes)} Changes`,
    );
  }
  return `${lines.join("\n")}\n`;
}
