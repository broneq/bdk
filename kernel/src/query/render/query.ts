// Text rendering of `bdk query`: a tab-separated header and rows.
import type { Cell, QueryPage } from "../domain/query.ts";

export function renderQuery(page: QueryPage): string {
  if (page.columns.length === 0) return "no rows\n";
  const line = (cells: readonly Cell[]): string =>
    cells.map((value) => (value === null ? "NULL" : String(value))).join("\t");
  return `${[page.columns.join("\t"), ...page.items.map(line)].join("\n")}\n`;
}
