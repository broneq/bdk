// The `rules show` handler: `<id>` prints one rule, `--ticket` the rules the
// ticket's active package records, `--role` with `--file` the rules of a role
// and a file set (T42); only the ticket form needs the Change.
import { globalDir } from "../../shared/config/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { FlagValue, Handler } from "../../shared/registry/index.ts";
import { renderRoleRules, renderRule, renderTicketRules } from "../render/show.ts";
import type { RulesDeps } from "../use-cases/deps.ts";
import { showRoleRules, showRule, showTicketRules } from "../use-cases/show.ts";

const FORMS =
  "rules show takes exactly one of <id>, --ticket <ticket> and --role <role> --file <path>";

function values(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

export function showCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const id = context.positionals["<id>"];
    const ticket = context.flags["--ticket"];
    const role = context.flags["--role"];
    const files = values(context.flags["--file"]);
    const byRole = role !== undefined || files.length > 0;
    const forms = [id !== undefined, ticket !== undefined, byRole].filter(Boolean).length;
    if (forms > 1) {
      return refuse("input/invalid-argument", FORMS, [
        "bdk rules show --ticket <ticket>",
        "bdk rules show --role <role> --file <path>",
      ]);
    }
    const projectRoot = () =>
      findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
    if (byRole) {
      if (typeof role !== "string" || files.length === 0) {
        return refuse("input/invalid-argument", "--role and --file go together", [
          "bdk rules show --role <role> --file <path>",
        ]);
      }
      const where = {
        projectRoot: projectRoot(),
        globalDir: globalDir(context.runtime),
        cwd: context.cwd,
      };
      const rules = showRoleRules(deps, where, role, files);
      return isRefusal(rules) ? rules : { data: rules, text: renderRoleRules(rules) };
    }
    if (typeof id === "string") {
      const rule = showRule(deps, projectRoot(), globalDir(context.runtime), id);
      return isRefusal(rule) ? rule : { data: rule, text: renderRule(rule) };
    }
    if (typeof ticket !== "string") {
      return refuse("input/missing-argument", FORMS, [
        "bdk rules show --ticket <ticket>",
        "bdk rules show --role <role> --file <path>",
      ]);
    }
    // The registration resolves the Change here: only the --ticket form needs one.
    const change = context.resolveChange?.();
    if (change === undefined) throw new Error("rules show resolves its Change in the handler");
    if (isRefusal(change)) return change;
    const rules = await showTicketRules(deps, change, globalDir(context.runtime), ticket);
    return isRefusal(rules) ? rules : { data: rules, text: renderTicketRules(rules) };
  };
}
