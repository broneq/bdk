// `bdk config check` (ADR-0008): every problem of every layer file.

import type { CheckResult } from "../schema/check.ts";
import { load } from "./load.ts";
import type { ConfigDeps } from "./load.ts";

export function check(deps: ConfigDeps): CheckResult {
  const { root, files, problems } = load(deps);
  return { root, layers: [...files], problems: [...problems] };
}
