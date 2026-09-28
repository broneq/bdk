// `bdk rules show --ticket <ticket>` (`kernel-cli/rules`; T23-D27, D28): the
// rules the ticket's role reads, resolved as prompt values, and the first
// call stamped as `rules-read` in the attempt record. The ticket must be
// open with a dispatch package; the role comes from the package.
import { withChangeIndex } from "../../log/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readAttempts, stampRulesRead, ticketDispatch } from "../../shared/store/index.ts";
import { ROLES } from "../../shared/vocabulary/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import type { TicketRules } from "../domain/report.ts";
import type { RulesDeps } from "./deps.ts";
import { roleSections } from "./sections.ts";

export function showTicketRules(
  deps: RulesDeps,
  change: ActiveChange,
  globalDir: string,
  ticket: string,
): Promise<TicketRules | Refusal> {
  return withChangeIndex(deps, change, (index) => {
    const record = readAttempts(deps.store, change.dir).find((file) => file.data.ticket === ticket);
    if (record === undefined) {
      return refuse("input/not-found", `${change.id} has no ticket ${ticket}`, [
        "bdk attempt list --all",
      ]);
    }
    const dispatch = ticketDispatch(index, change.id, ticket);
    if (dispatch === undefined) {
      const why =
        record.data.outcome === undefined
          ? `ticket ${ticket} has no dispatch package`
          : `ticket ${ticket} is closed ${record.data.outcome}`;
      return refuse("policy/no-open-ticket", why, [
        `bdk dispatch build ${record.data.target} <role> ${ticket}`,
        "bdk attempt list",
      ]);
    }
    const resolved = resolveOrRefuse(
      {
        store: deps.store,
        settings: deps.settings,
        globalDir,
        projectRoot: change.projectRoot,
        pluginRoot: deps.pluginRoot,
      },
      { removed: "ignore" },
    );
    if ("refused" in resolved) return resolved;
    const sections = isRole(dispatch.role) ? roleSections(deps, resolved, dispatch.role) : [];
    const rulesRead = stampRulesRead(deps.store, change.dir, ticket, deps.clock.now());
    if (rulesRead === undefined) throw new Error(`the attempt record of ${ticket} disappeared`);
    return { ticket, role: dispatch.role, target: record.data.target, sections, rulesRead };
  });
}

function isRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}
