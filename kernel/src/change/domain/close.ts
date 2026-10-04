// The PR summary `change close` prints (`kernel-cli/change`; T30-D12, T42-H):
// built from the ledger alone, so it reads the same before and after T31. An
// open finding carries the human's disposition.
export interface SummaryEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly disposition?: string | undefined;
  readonly issue?: string | undefined;
  readonly review?: boolean | undefined;
}

const SECTIONS = [
  ["Decisions", ["decision"]],
  ["Assumptions", ["assumption"]],
  ["Risks", ["risk"]],
  ["Open findings", ["finding", "observation", "blocker"]],
] as const;

/** `entries` are the live ones: the caller drops superseded and resolved entries. */
export function closeSummary(
  intent: string,
  entries: readonly SummaryEntry[],
  merged: readonly string[],
): string {
  const blocks = [`## ${intent}`];
  for (const [title, types] of SECTIONS) {
    const listed = entries.filter((entry) => (types as readonly string[]).includes(entry.type));
    if (listed.length === 0) continue;
    blocks.push(
      `### ${title}\n\n${listed.map((entry) => `- ${entry.summary}${decided(entry)} (${entry.id})`).join("\n")}`,
    );
  }
  blocks.push(
    merged.length === 0
      ? "### Spec\n\nNo spec change."
      : `### Spec\n\n${merged.map((capability) => `- \`${capability}\``).join("\n")}`,
  );
  return `${blocks.join("\n\n")}\n`;
}

/** ` (deferred, to be reviewed)`, ` (tracked in <issue>)`, or nothing without a disposition. */
function decided(entry: SummaryEntry): string {
  const parts: string[] = [];
  if (entry.disposition === "defer") parts.push("deferred");
  if (entry.disposition === "track") parts.push(`tracked in ${entry.issue ?? "the tracker"}`);
  if (parts.length > 0 && entry.review === true) parts.push("to be reviewed");
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}
