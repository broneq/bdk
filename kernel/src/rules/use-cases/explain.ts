// `bdk rules explain` (`kernel-cli/rules`): the selection `dispatch build`
// makes, for a file set of one file and a role, without the cap, so a user
// sees why a rule is present, missing or beyond `rules.max-per-package`.
import { relative, resolve, sep } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import type { ExplainReport } from "../domain/report.ts";
import { selectFor } from "./context.ts";
import type { RulesDeps } from "./deps.ts";
import { loadContext } from "./settings.ts";

export function explainRules(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  cwd: string,
  file: string,
  role: Role,
): ExplainReport | Refusal {
  const inside = relative(projectRoot, resolve(cwd, file));
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`)) {
    return refuse("input/not-found", `${file} resolves outside the repository ${projectRoot}`, [
      "bdk rules explain <path inside the repository>",
    ]);
  }
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const path = inside.split(sep).join("/");
  const selection = selectFor(context, role, [path]);
  const listed = (beyondCap: boolean) =>
    (beyondCap ? selection.beyondCap : selection.selected).map(({ rule, matchedBy }) => ({
      id: rule.id,
      matchedBy,
      kind: rule.kind,
      beyondCap,
    }));
  return {
    file: path,
    role,
    rules: [...listed(false), ...listed(true)],
    disabled: selection.disabled,
  };
}
