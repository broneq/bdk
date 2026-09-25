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
