// The resolved settings and the loaded rules every rules command starts from.
// A removed settings key is ignored here, as in `rules show`, so an old
// `rules.propose-when` never blocks reading the rules.
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { ruleContext } from "./context.ts";
import type { RuleContext } from "./context.ts";
import type { RulesDeps } from "./deps.ts";

/** What reading the rules needs; `doctor` has no index, git or clock to give. */
export type ReadDeps = Pick<RulesDeps, "store" | "pluginRoot" | "settings">;

export function loadContext(
  deps: ReadDeps,
  projectRoot: string,
  globalDir: string,
): RuleContext | Refusal {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  if ("refused" in resolved) return resolved;
  return ruleContext({ store: deps.store, pluginRoot: deps.pluginRoot, projectRoot }, resolved);
}
