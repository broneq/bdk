// The rules load `hooks session-start` warns about (`kernel-cli/hooks`; design
// D-5 of v3-t31): selection has no cap, so the role that would read the most
// rules is counted as `rules explain` selects them with no file set, every
// scoped rule included, and compared with `rules.warn-above`.
import { ROLES } from "../../shared/vocabulary/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { selectFor } from "./context.ts";
import { loadContext } from "./settings.ts";
import type { ReadDeps } from "./settings.ts";

export interface RulesLoad {
  readonly role: Role;
  readonly rules: number;
  /** `rules.warn-above`. */
  readonly limit: number;
}

/** The heaviest role when it reads more than `rules.warn-above`; undefined otherwise. */
export function rulesOverLimit(
  deps: ReadDeps,
  projectRoot: string,
  globalDir: string,
): RulesLoad | undefined {
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return undefined;
  let heaviest: RulesLoad | undefined;
  for (const role of ROLES) {
    const rules = selectFor(context, role, undefined).selected.length;
    if (heaviest === undefined || rules > heaviest.rules) {
      heaviest = { role, rules, limit: context.warnAbove };
    }
  }
  return heaviest !== undefined && heaviest.rules > heaviest.limit ? heaviest : undefined;
}
