// `bdk rules accept` (`kernel-cli/rules`; design D-6 of v3-t31): the user's
// explicit adoption, the only path by which a rule file is created outside
// an import. It runs no model and proposes nothing, needs no active Change,
// and regenerates the projection after the write.
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { CHANGE_ID_PATTERN } from "../../shared/ids/index.ts";
import {
  ensureFormatterGuard,
  findEntry,
  hasAttempt,
  refreshAll,
  withIndex,
} from "../../shared/store/index.ts";
import { prefixProblem } from "../domain/import.ts";
import type { AcceptReport } from "../domain/report.ts";
import type { RulesDeps } from "./deps.ts";
import { regenerate } from "./export.ts";
import { loadContext } from "./settings.ts";
import {
  draftProblem,
  duplicateRefusal,
  numberer,
  ruleDraft,
  ruleFormat,
  writeRule,
} from "./write.ts";

export interface AcceptInput {
  readonly text: string;
  readonly prefix: string;
  readonly kind: "house" | "knowledge";
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly applies: readonly string[];
  readonly roles: readonly string[];
  readonly from: readonly string[];
  readonly source?: string | undefined;
  readonly verified?: string | undefined;
}

const FROM = new RegExp(`^(${CHANGE_ID_PATTERN})/([LA]-[0-9a-z]{8})$`);

export async function acceptRule(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  input: AcceptInput,
): Promise<AcceptReport | Refusal> {
  const text = input.text.trim();
  if (text === "") {
    return refuse("input/invalid-argument", "the rule text is empty", [
      'bdk rules accept "<one choice, stated as an instruction>" --prefix <PREFIX>',
    ]);
  }
  const badPrefix = prefixProblem(input.prefix);
  if (badPrefix !== undefined)
    return ruleFormat(badPrefix, "pick a project prefix, e.g. --prefix API");
  if (input.kind === "knowledge" && (input.source === undefined || input.verified === undefined)) {
    return ruleFormat(
      "a knowledge rule needs --source and --verified (T5)",
      "add --source <where the fact comes from> --verified <YYYY-MM-DD>",
    );
  }
  if (input.kind === "house" && (input.source !== undefined || input.verified !== undefined)) {
    return ruleFormat(
      "--source and --verified belong to a knowledge rule",
      "add --kind knowledge, or drop --source and --verified",
    );
  }
  const malformed = input.from.find((ref) => !FROM.test(ref));
  if (malformed !== undefined) {
    return refuse(
      "input/invalid-argument",
      `--from ${malformed} is no qualified entry or ticket id (<changeId>/L-... or <changeId>/A-...)`,
      ["bdk rules stats --entries", "bdk log list"],
    );
  }
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const duplicate = duplicateRefusal(context, [input.prefix]);
  if (duplicate !== undefined) return duplicate;

  const missing = await withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshAll(index);
    return input.from.find((ref) => {
      const [, changeId = "", id = ""] = FROM.exec(ref) ?? [];
      return id.startsWith("L-")
        ? findEntry(index, changeId, id) === undefined
        : !hasAttempt(index, changeId, id);
    });
  });
  if (missing !== undefined) {
    return refuse("input/not-found", `--from ${missing} names nothing the index holds`, [
      "bdk rules stats --entries",
    ]);
  }

  const id = `${input.prefix}-${String(numberer(deps.store, projectRoot, context)(input.prefix))}`;
  const origin = input.from[0] ?? "user";
  const draft = ruleDraft(id, text, {
    kind: input.kind,
    applies: input.applies,
    roles: input.roles,
    severity: input.severity,
    origin,
    evidence: input.from,
    since: deps.clock.now().slice(0, 10),
    source: input.source,
    verified: input.verified,
  });
  const problem = draftProblem(draft);
  if (problem !== undefined) return ruleFormat(`${id}: ${problem}`, "fix the flag named");
  ensureFormatterGuard(deps.store, projectRoot);
  const path = writeRule(deps.store, projectRoot, draft);
  const after = loadContext(deps, projectRoot, globalDir);
  if ("refused" in after) return after;
  return { id, path, origin, projection: regenerate(deps.store, projectRoot, after) };
}
