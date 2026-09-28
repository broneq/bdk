// The `rules show` handler: `--ticket` prints the ticket's rules; the `<id>`
// form lands with T31 and answers `kernel/not-implemented` until then.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderTicketRules } from "../render/show.ts";
import type { RulesDeps } from "../use-cases/deps.ts";
import { showTicketRules } from "../use-cases/show.ts";

export function showCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const id = context.positionals["<id>"];
    const ticket = context.flags["--ticket"];
    if (id !== undefined && ticket !== undefined) {
      return refuse("input/invalid-argument", "rules show takes <id> or --ticket, not both", [
        "bdk rules show --ticket <ticket>",
      ]);
    }
    if (id !== undefined) {
      return refuse(
        "kernel/not-implemented",
        "bdk rules show <id> is not implemented yet; it lands with task T31",
        ["bdk rules show --ticket <ticket>", "bdk rules --help"],
      );
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
