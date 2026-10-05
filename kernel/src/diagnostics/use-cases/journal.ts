// The run journal read back (`kernel-state`, Run journal): each line that
// parses against the line schema, with its 1-based line number for citations.
import { journalLine } from "../../shared/store/index.ts";
import type { NumberedLine } from "../domain/facts.ts";

export function parseJournal(text: string): NumberedLine[] {
  const lines: NumberedLine[] = [];
  for (const [index, raw] of text.split("\n").entries()) {
    if (raw.trim() === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      continue;
    }
    const parsed = journalLine.safeParse(value);
    if (parsed.success) lines.push({ ...parsed.data, n: index + 1 });
  }
  return lines;
}
