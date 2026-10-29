// Text of `bdk config set` (ADR-0008).

import type { SetResult } from "../schema/set.ts";

export function renderSet(result: SetResult): string {
  return `${result.key}: ${JSON.stringify(result.value)}  # ${result.layer} ${result.file}`;
}
