// Why a check plan skipped an entry, in the words of `bdk check plan` and `bdk check record`.

import type { Skipped } from "../domain/plan.ts";

export function skipReason(entry: Skipped): string {
  return entry.reason === "paths"
    ? "no file it takes matches its paths"
    : "no files for its {files}";
}
