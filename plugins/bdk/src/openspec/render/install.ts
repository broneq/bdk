// The text of `bdk openspec install`: a count line, then one line per file.

import type { InstallResult } from "../schema/install.ts";

export function renderInstall(result: InstallResult): string {
  const count = (status: string): string =>
    String(result.files.filter((file) => file.status === status).length);
  const lines = [
    `Installed the BDK OpenSpec schema in ${result.target}: ${count("added")} added, ${count("updated")} updated, ${count("unchanged")} unchanged`,
    ...result.files.map((file) => `  ${file.status.padEnd(9)}  ${file.path}`),
  ];
  return `${lines.join("\n")}\n`;
}
