// The `rules` entries of the configuration (spec `rule-pack`, "Project rules" and "Switching
// rules off"; design D5): a `BDK-` entry adjusts a pack rule, any other entry is a project rule
// with the defaults the configuration schema leaves out.

import { PACK_PREFIX } from "./rule.ts";
import type { Origin, Rule, Stage } from "./rule.ts";

/** A resolved `rules.<id>` entry, as the config slice validated it. */
export interface RuleEntry {
  readonly text?: string | undefined;
  readonly file?: string | undefined;
  readonly kind?: Rule["kind"] | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly stages?: readonly Stage[] | undefined;
  readonly source?: string | undefined;
  readonly verified?: string | undefined;
  readonly enabled?: boolean | undefined;
}

export function isPackId(id: string): boolean {
  return id.startsWith(PACK_PREFIX);
}

export interface Adjusted {
  /** The enabled pack rules, with the `paths` and `stages` of their entries. */
  readonly rules: readonly Rule[];
  readonly warnings: readonly string[];
}

/** The pack rules as the `BDK-` entries adjust them, and a warning per entry naming no rule. */
export function adjustPack(
  pack: readonly Rule[],
  entries: Readonly<Record<string, RuleEntry>>,
  closest: (input: string, names: readonly string[]) => string | undefined,
): Adjusted {
  const ids = pack.map((rule) => rule.id);
  const warnings = Object.keys(entries)
    .filter((id) => isPackId(id) && !ids.includes(id))
    .map((id) => {
      const near = closest(id, ids);
      return `rules.${id} names no rule of the BDK pack${near === undefined ? "" : `; did you mean ${near}?`}`;
    });
  const rules = pack.flatMap((rule) => {
    const entry = entries[rule.id];
    if (entry === undefined) return [rule];
    if (entry.enabled === false) return [];
    return [{ ...rule, paths: entry.paths ?? rule.paths, stages: entry.stages ?? rule.stages }];
  });
  return { rules, warnings };
}

export interface ProjectRuleInput {
  readonly id: string;
  readonly entry: RuleEntry;
  readonly origin: Exclude<Origin, "bdk">;
  /** The layer file of an inline rule, or the path its `file` names. */
  readonly file: string;
  /** The rule text: `text`, or the body of the `file`. */
  readonly text: string;
}

/** A project rule with the defaults: `house`, every file, the stages `execute` and `review`. */
export function projectRule(input: ProjectRuleInput): Rule {
  const { entry } = input;
  return {
    id: input.id,
    origin: input.origin,
    language: null,
    file: input.file,
    kind: entry.kind ?? "house",
    paths: entry.paths ?? ["**"],
    stages: entry.stages ?? ["execute", "review"],
    source: entry.source ?? null,
    verified: entry.verified ?? null,
    measured: null,
    text: input.text,
  };
}
