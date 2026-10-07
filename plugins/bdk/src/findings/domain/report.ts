// The round report `bdk findings report` writes (spec `bdk-cli/findings`, "Round report"): a pure
// function of the fold, every level section always present so a reader finds it by name.
import { countsLine } from "./counts.ts";
import { LEVELS } from "./events.ts";
import type { Finding, View } from "./fold.ts";

function place({ file, line }: Finding): string {
  if (file === undefined) return "-";
  return line === undefined ? `\`${file}\`` : `\`${file}:${line}\``;
}

function note(name: string, text: string | undefined): string[] {
  return text === undefined ? [] : [`  - ${name}: ${text.replaceAll("\n", "\n    ")}`];
}

function item(finding: Finding): string[] {
  const rule = finding.rule === undefined ? "" : ` [${finding.rule}]`;
  const decision =
    finding.decision === null
      ? undefined
      : finding.issue === undefined
        ? finding.decision
        : `${finding.decision} ${finding.issue}`;
  return [
    `- ${finding.id} ${place(finding)}${rule} ${finding.summary} (${finding.sources.join(", ")})`,
    ...note("Evidence", finding.evidence),
    ...note("Level reason", finding.levelReason),
    ...note("Decision", decision),
    ...note("Decision reason", finding.decisionReason),
  ];
}

export function reportMarkdown({ findings, counts, skipped }: View): string {
  const lines = ["# Review round report", "", countsLine(counts)];
  for (const level of [...LEVELS, "unleveled" as const]) {
    const of = findings.filter((finding) => (finding.level ?? "unleveled") === level);
    lines.push("", `## ${level}`, "", ...(of.length === 0 ? ["None."] : of.flatMap(item)));
  }
  if (skipped.length > 0) {
    lines.push("", "## Skipped lines", "", ...skipped.map((s) => `- Line ${s.line}: ${s.reason}`));
  }
  return `${lines.join("\n")}\n`;
}
