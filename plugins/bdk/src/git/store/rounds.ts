// The round records under a run's `review/` directory (spec `bdk-cli/git`, "Round record",
// "Recording a round"; design D3).

import { join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";
import { roundNumbers } from "../domain/range.ts";

export const RECORD = "groups.json";
const REPORT = "review.md";

/** The last round whose directory holds `review.md`, with the text of its record if any. */
export function lastFinishedRound(
  files: Files,
  dir: string,
): { readonly round: number; readonly record: string | undefined } | undefined {
  for (const round of roundNumbers(files.list(dir) ?? [])) {
    const roundDir = join(dir, `round-${round}`);
    const finished = (files.list(roundDir) ?? []).some(
      (entry) => entry.name === REPORT && !entry.dir,
    );
    if (finished) return { round, record: files.readText(join(roundDir, RECORD)) };
  }
  return undefined;
}

/** Writes the record of the round in `roundDir`, replacing an earlier one. */
export function writeRecord(files: Files, roundDir: string, json: string): void {
  files.writeText(join(roundDir, RECORD), json);
}
