// Text of `bdk config set` (spec `bdk-cli/config`, "config set").

import type { SetResult } from "../schema/set.ts";

export function renderSet(result: SetResult): string {
  return `${result.key}: ${JSON.stringify(result.value)}  # ${result.layer} ${result.file}`;
}
