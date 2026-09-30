// Writing a project rule file, shared by `rules accept` and `rules import`:
// the next free number of a prefix (tombstones included, so a number is
// never reused), the frontmatter checked against the rule schema before any
// write, and the refusal when the prefix already carries a duplicate id.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { STATE_KINDS, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { numberOf, prefixOf } from "../domain/rule.ts";
import type { RuleContext } from "./context.ts";
import { formatRefusal } from "./check.ts";
import { PROJECT_RULES_DIR } from "./store.ts";

export interface RuleDraft {
  readonly id: string;
  readonly text: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Hands out numbers per prefix above every existing project file and every id already handed out. */
export function numberer(
  store: Store,
  projectRoot: string,
  context: RuleContext,
): (prefix: string) => number {
  const highest = new Map<string, number>();
  const seen = (id: string): void => {
    const prefix = prefixOf(id);
    highest.set(prefix, Math.max(highest.get(prefix) ?? 0, numberOf(id)));
  };
  for (const rule of context.rules) if (rule.scope === "project") seen(rule.id);
  for (const name of store.list(join(projectRoot, PROJECT_RULES_DIR))) {
    const id = name.replace(/\.md$/, "");
    if (/-[1-9][0-9]*$/.test(id)) seen(id);
  }
  return (prefix) => {
    const next = (highest.get(prefix) ?? 0) + 1;
    highest.set(prefix, next);
    return next;
  };
}

/** Refuses when the project's rules already fail with a duplicate id of one of the prefixes. */
export function duplicateRefusal(
  context: RuleContext,
  prefixes: readonly string[],
): Refusal | undefined {
  return formatRefusal(
    context.problems.filter(
      (problem) =>
        problem.code === "duplicate-id" &&
        problem.id !== undefined &&
        prefixes.includes(prefixOf(problem.id)),
    ),
  );
}

/** Why the draft's frontmatter fails the rule schema, or undefined. */
export function draftProblem(draft: RuleDraft): string | undefined {
  const parsed = STATE_KINDS.rule.schema.safeParse(draft.data);
  if (parsed.success) return undefined;
  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/** Writes `.bdk/rules/<id>.md`; returns the path relative to the project root. */
export function writeRule(store: Store, projectRoot: string, draft: RuleDraft): string {
  const path = `${PROJECT_RULES_DIR}/${draft.id}.md`;
  writeDocument(store, join(projectRoot, path), { data: draft.data, body: `${draft.text}\n` });
  return path;
}

export function ruleDraft(
  id: string,
  text: string,
  fields: Readonly<Record<string, unknown>>,
): RuleDraft {
  const entries: [string, unknown][] = Object.entries({ schema: 1, id, ...fields });
  const data = Object.fromEntries(
    entries.filter(
      ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  );
  return { id, text, data };
}

export function ruleFormat(why: string, instead: string): Refusal {
  return refuse("policy/rule-format", why, [instead, "bdk rules check"]);
}
