import { countsLine } from "../domain/counts.ts";
import type { ReportResult } from "../schema/report.ts";

export function renderReport({ report, counts }: ReportResult): string {
  return `${report}\n${countsLine(counts)}`;
}
