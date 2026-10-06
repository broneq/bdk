// The rule check of `doctor` (`kernel-cli/service`; T31): a read-only answer
// to what `rules check` would refuse, so the diagnosis and the command cannot
// disagree. `.claude/rules/` belongs to the project and is never read.
import { join } from "node:path";

import { formatRefusal } from "./check.ts";
import { loadContext } from "./settings.ts";
import type { ReadDeps } from "./settings.ts";
import { PROJECT_RULES_DIR } from "./store.ts";

/** Why `rules check` refuses; undefined when it passes or the project has no `.bdk/rules/`. */
export function ruleHealth(
  deps: ReadDeps,
  projectRoot: string,
  globalDir: string,
): string | undefined {
  if (!deps.store.exists(join(projectRoot, PROJECT_RULES_DIR))) return undefined;
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context.why;
  return formatRefusal(context.problems)?.why;
}
