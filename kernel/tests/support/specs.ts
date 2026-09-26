// Readers for the Markdown specs: requirement sections, table columns and
// inline code spans, shared by the contract tests.
import assert from "node:assert/strict";

export function requirement(text: string, title: string): string {
  const re = new RegExp(
    `^### Requirement: ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=^### Requirement: |(?![\\s\\S]))`,
    "m",
  );
  const m = text.match(re);
  assert.ok(m, `requirement "${title}" not found`);
  return m[1] ?? "";
}

// Rows of the one table whose header's first cell is `headerCell`; stops at
// the first non-table line so a later table in the same section is not read.
export function tableFirstColumn(text: string, headerCell: string): string[][] {
  const lines = text.split("\n");
  const headerIndex = lines.findIndex(
    (line) => line.startsWith("|") && line.split("|")[1]?.trim() === headerCell,
  );
  assert.ok(headerIndex >= 0, `table with first column "${headerCell}" not found`);
  const out: string[][] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) break;
    out.push(
      line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }
  return out;
}

// Inline code spans only: fenced blocks are removed first so their triple
// backticks cannot pair with inline ones.
export function backticked(text: string): string[] {
  const noFences = text.replace(/^```[\s\S]*?^```/gm, "");
  return [...noFences.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)].map((m) => m[1] ?? "");
}

export interface Row {
  readonly cells: readonly string[];
  readonly header: readonly string[];
}

/** Every row of every table whose first header cell is `first`; `\|` stays inside a cell. */
export function tableRows(text: string, first: string): Row[] {
  const out: Row[] = [];
  const lines = text.split("\n");
  lines.forEach((line, at) => {
    const header = cells(line);
    if (header[0] !== first || !(lines[at + 1] ?? "").startsWith("| -")) return;
    for (const row of lines.slice(at + 2)) {
      if (!row.startsWith("|")) break;
      out.push({ header, cells: cells(row) });
    }
  });
  return out;
}

function cells(line: string): string[] {
  if (!line.startsWith("|")) return [];
  return line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function column(row: Row, name: string): string {
  const at = row.header.indexOf(name);
  if (at === -1) throw new Error(`no column ${name} in ${row.header.join(" | ")}`);
  return row.cells[at] ?? "";
}
