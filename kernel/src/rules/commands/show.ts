// The `rules show` handler: `<id>` prints one rule, `--ticket` the rules the
// ticket's active package records.
import { globalDir } from "../../shared/config/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderRule, renderTicketRules } from "../render/show.ts";
import type { RulesDeps } from "../use-cases/deps.ts";
import { showRule, showTicketRules } from "../use-cases/show.ts";

export function showCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const id = context.positionals["<id>"];
    const ticket = context.flags["--ticket"];
    if (id !== undefined && ticket !== undefined) {
      return refuse("input/invalid-argument", "rules show takes <id> or --ticket, not both", [
        "bdk rules show --ticket <ticket>",
      ]);
    }
    if (typeof id === "string") {
      const projectRoot =
        context.change?.projectRoot ??
        findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
      const rule = showRule(deps, projectRoot, globalDir(context.runtime), id);
      return isRefusal(rule) ? rule : { data: rule, text: renderRule(rule) };
    }
    if (typeof ticket !== "string") {
      return refuse("input/missing-argument", "rules show needs <id> or --ticket <ticket>", [
        "bdk rules show --ticket <ticket>",
      ]);
    }
    if (context.change === undefined) throw new Error("rules show is Change-scoped");
    const rules = await showTicketRules(deps, context.change, globalDir(context.runtime), ticket);
    return isRefusal(rules) ? rules : { data: rules, text: renderTicketRules(rules) };
  };
}
