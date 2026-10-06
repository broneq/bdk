// A Markdown table in the bytes Prettier writes for it: every column padded to
// its widest cell, a rule of at least three dashes, cells left-aligned. The
// generated indexes use it, so a Prettier pass changes no byte (`kernel-state`,
// Markdown document shape). Callers escape `|` in cells.

const graphemes = new Intl.Segmenter();

/** The table and one final newline. */
export function markdownTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const cells = [header, ...rows];
  const widths = header.map((_, column) =>
    Math.max(3, ...cells.map((row) => width(row[column] ?? ""))),
  );
  const line = (row: readonly string[]): string =>
    `| ${widths.map((size, column) => pad(row[column] ?? "", size)).join(" | ")} |`;
  const rule = line(widths.map((size) => "-".repeat(size)));
  return [line(header), rule, ...rows.map(line), ""].join("\n");
}

function pad(cell: string, size: number): string {
  return cell + " ".repeat(size - width(cell));
}

/** Display width in graphemes; wide East Asian characters and emoji count as one. */
function width(text: string): number {
  return [...graphemes.segment(text)].length;
}
