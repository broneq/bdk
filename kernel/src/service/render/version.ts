import type { VersionOutput } from "../schema/version.ts";

export function renderVersion(output: VersionOutput): string {
  return `bdk ${output.kernel} (contract ${output.contract}, node ${output.node})\n`;
}
