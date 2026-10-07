// The check `level` and `decide` share: the id names a finding of the log (design D3).
import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { fold } from "../domain/fold.ts";
import { readLog } from "../store/log.ts";

export function requireFinding(files: Files, log: string, id: string): void {
  const known = fold(readLog(files, log) ?? "").findings.some((finding) => finding.id === id);
  if (!known) {
    throw new CliError(
      "usage/unknown-finding",
      `no finding in ${log} has the id ${id}`,
      `Run bdk findings list ${log} for the ids.`,
    );
  }
}
