// `bdk rules show` (`kernel-cli/rules`; T23-D27, D28, T31): one rule by id,
// tombstones and disabled rules included, or the rules whose ids the ticket's
// active package records, in that order. The first `--ticket` call under the
// implementer's package stamps `rules-read` in the attempt record (T23-D42,
// risk R2). The ticket must be open with a dispatch package; `<ticket>@<group>`
// reads the package of that review group (T42-A1).
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  readPlanParts,
  refreshChange,
  resolveTicketRef,
  stampRulesRead,
  targetFiles,
  withIndex,
} from "../../shared/store/index.ts";
import type { OneRule, TicketRules } from "../domain/report.ts";
import type { RulesDeps } from "./deps.ts";
import { matchedGlob } from "./selection.ts";
import { loadContext } from "./settings.ts";

export function showRule(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  id: string,
): OneRule | Refusal {
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const rule = context.rules.find((found) => found.id === id);
  if (rule === undefined) {
    return refuse("input/not-found", `no rule of the bundle or of .bdk/rules/ has the id ${id}`, [
      "bdk rules check",
      "bdk rules explain <file>",
    ]);
  }
  const optional = {
    applies: rule.applies,
    roles: rule.roles,
    evidence: rule.evidence,
    source: rule.source,
    verified: rule.verified,
    removed: rule.removed,
  };
  return {
    id: rule.id,
    scope: rule.scope,
    file: rule.file,
    kind: rule.kind,
    severity: rule.severity,
    origin: rule.origin,
    since: rule.since,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
    disabled: context.disabled.includes(id),
    text: rule.text,
  };
}

export function showTicketRules(
  deps: RulesDeps,
  change: ActiveChange,
  globalDir: string,
  value: string,
): Promise<TicketRules | Refusal> {
  return withIndex(deps.openIndex, deps.store, change.projectRoot, (index) => {
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    const resolved = resolveTicketRef(deps.store, change.projectRoot, change.dir, value);
    if (isRefusal(resolved)) return resolved;
    const { ticket, group, record } = resolved;
    if (record === undefined) {
      return refuse("input/not-found", `${change.id} has no ticket ${ticket}`, [
        "bdk attempt list --all",
      ]);
    }
    const dispatch = resolved.open ? resolved.package : undefined;
    if (dispatch === undefined) {
      const why =
        record.data.outcome !== undefined
          ? `ticket ${ticket} is closed ${record.data.outcome}`
          : group === undefined
            ? `ticket ${ticket} has no dispatch package`
            : `group ${group} of ticket ${ticket} has no dispatch package`;
      return refuse("policy/no-open-ticket", why, [
        `bdk dispatch build ${record.data.target} <role> ${ticket}${group === undefined ? "" : ` --group ${group}`}`,
        "bdk attempt list",
      ]);
    }
    const context = loadContext(deps, change.projectRoot, globalDir);
    if ("refused" in context) return context;
    const loaded = new Map(context.rules.map((rule) => [rule.id, rule]));
    const missing = dispatch.data.rules.filter((id) => !loaded.has(id));
    if (missing.length > 0) {
      return refuse(
        "input/not-found",
        `the package of ticket ${ticket} records ${missing.join(", ")}, which no rule file holds`,
        [`bdk dispatch build ${record.data.target} ${dispatch.role} ${value}`],
      );
    }
    // A group's package records its own file set (T42-A1); none means every rule applied.
    const groupFiles = dispatch.data.files ?? [];
    const files =
      group === undefined
        ? targetFiles(readPlanParts(deps.store, change.dir), record.data.target)
        : groupFiles.length === 0
          ? undefined
          : groupFiles;
    const rules = dispatch.data.rules.flatMap((id) => {
      const rule = loaded.get(id);
      if (rule === undefined) return [];
      return [
        {
          id,
          kind: rule.kind,
          severity: rule.severity,
          ...(rule.applies === undefined ? {} : { applies: rule.applies }),
          matchedBy: matchedGlob(rule, files),
          text: rule.text,
        },
      ];
    });
    const rulesRead =
      dispatch.role === "implementer"
        ? stampRulesRead(deps.store, change.dir, ticket, deps.clock.now())
        : record.data["rules-read"];
    return {
      ticket,
      ...(group === undefined ? {} : { group }),
      role: dispatch.role,
      target: record.data.target,
      rules,
      ...(rulesRead === undefined ? {} : { rulesRead }),
    };
  });
}
