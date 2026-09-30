// The PR summary `change close` prints (`kernel-cli/change`; T30-D12): built
// from the ledger alone, so it reads the same before and after T31.
export interface SummaryEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
}

const SECTIONS = [
  ["Decisions", ["decision"]],
  ["Assumptions", ["assumption"]],
  ["Risks", ["risk"]],
  ["Open findings", ["finding", "blocker"]],
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
      `### ${title}\n\n${listed.map((entry) => `- ${entry.summary} (${entry.id})`).join("\n")}`,
    );
  }
  blocks.push(
    merged.length === 0
      ? "### Spec\n\nNo spec change."
      : `### Spec\n\n${merged.map((capability) => `- \`${capability}\``).join("\n")}`,
  );
  return `${blocks.join("\n\n")}\n`;
}
