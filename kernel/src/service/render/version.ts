import type { VersionReport } from "../domain/report.ts";

export function renderVersion(output: VersionReport): string {
  return `bdk ${output.kernel} (contract ${output.contract}, node ${output.node})\n`;
}
