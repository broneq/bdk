import type { SchemaReport } from "../domain/report.ts";

/** The schema as JSON; with --url, only the URL and the offline copy. */
export function renderSchema(report: SchemaReport): string {
  if (report.schema === undefined) {
    return `${report.url}\n${report.offlineCopy === undefined ? "" : `offline copy: ${report.offlineCopy}\n`}`;
  }
  return `${JSON.stringify(report.schema, null, 2)}\n`;
}
