// Text renderings of the log commands (`kernel-cli`, Output modes).
import type { AppendResult, EntrySummary, ResolveResult, ShownEntry } from "../domain/entry.ts";

export function renderAdd(result: AppendResult): string {
  const { entry } = result;
  const verb = result.deduplicated ? "already recorded as" : "added";
  return `${verb} ${entry.id} (${entry.type}, ${entry.status}): ${entry.summary}\n${result.path}\n`;
}

/** Every matching entry, one per line; the command caps the lines unless `--all`. */
export function renderList(items: readonly EntrySummary[]): string {
  if (items.length === 0) return "no entries\n";
  const lines = items.map((entry) => {
    const flags = [
      entry.review === true ? "review" : "",
      entry.supersededBy === undefined ? "" : `by ${entry.supersededBy}`,
    ]
      .filter((flag) => flag !== "")
      .join(", ");
    const suffix = flags === "" ? "" : ` (${flags})`;
    return `${entry.id} ${entry.type} ${entry.status}: ${entry.summary} [${entry.refs.join(", ")}]${suffix}`;
  });
  return `${lines.join("\n")}\n`;
}

export function renderShow(shown: ShownEntry): string {
  const { entry } = shown;
  const lines = [
    `${entry.id} ${entry.type} ${entry.status}: ${entry.summary}`,
    `source: ${entry.source}, author: ${entry.author}, at: ${entry.at}`,
    `refs: ${entry.refs.join(", ")}`,
  ];
  if (entry.ticket !== undefined) lines.push(`ticket: ${entry.ticket}`);
  if (entry.supersedes !== undefined) lines.push(`supersedes: ${entry.supersedes}`);
  if (shown.supersededBy !== undefined) lines.push(`superseded by: ${shown.supersededBy}`);
  lines.push(entry.path);
  const body = entry.body.trim();
  return `${lines.join("\n")}\n${body === "" ? "" : `\n${body}\n`}`;
}

export function renderResolve(result: ResolveResult): string {
  const by = result.by === undefined ? "" : ` by ${result.by}`;
  const reason = result.reason === undefined ? "" : `: ${result.reason}`;
  return `${result.entry} ${result.status}${by}${reason} (rewrote ${result.record})\n`;
}
