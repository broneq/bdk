// The rendered STARTUP instructions. The agents table is aligned the way
// Prettier formats a Markdown table, so the committed file passes
// `pnpm format:check` unchanged.
import type { AgentRow, ContextReport, StartupSource } from "../domain/report.ts";

export function renderStartup({ before, rows, after }: StartupSource): ContextReport {
  const table = agentsTable(rows).trimEnd().split("\n");
  return {
    content: [...before, "", ...table, "", ...after].join("\n"),
    parts: [
      { kind: "startup", source: "STARTUP_INSTRUCTIONS.md" },
      { kind: "agents-table", source: "agents/" },
    ],
  };
}

const HEADER = ["`subagent_type`", "Model", "When to pick"] as const;

function agentsTable(rows: readonly AgentRow[]): string {
  const cells = [
    [...HEADER],
    ...rows.map((row) => [
      `\`bdk:${row.name}\``,
      row.model,
      row.description.replaceAll("|", "\\|"),
    ]),
  ];
  const widths = HEADER.map((_, column) =>
    Math.max(3, ...cells.map((row) => width(row[column] ?? ""))),
  );
  const line = (row: readonly string[]) =>
    `| ${row.map((cell, column) => cell + " ".repeat((widths[column] ?? 0) - width(cell))).join(" | ")} |`;
  const [header, ...body] = cells;
  return (
    [line(header ?? []), line(widths.map((size) => "-".repeat(size))), ...body.map(line)].join(
      "\n",
    ) + "\n"
  );
}

const graphemes = new Intl.Segmenter();

/** Display width in graphemes; agent descriptions hold no wide characters. */
function width(text: string): number {
  return [...graphemes.segment(text)].length;
}
