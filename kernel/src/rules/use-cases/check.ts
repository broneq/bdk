// `bdk rules check` (`kernel-cli/rules`): every rule file of the bundle and of
// `.bdk/rules/` against the rule frontmatter, unique ids across both, and the
// ids `rules.disabled` names. Problems refuse with the first one, as `config
// check` does; the other commands that write rules refuse the same way.
import { join, relative, resolve, sep } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { CheckReport } from "../domain/report.ts";
import type { RuleProblem } from "../domain/rule.ts";
import type { RulesDeps } from "./deps.ts";
import { loadContext } from "./settings.ts";

export function checkRules(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  cwd: string,
  path: string | undefined,
): CheckReport | Refusal {
  const scope = path === undefined ? undefined : resolve(cwd, path);
  if (scope !== undefined && !deps.store.exists(scope)) {
    return refuse("input/not-found", `${path ?? ""} does not exist`, [
      "bdk rules check",
      "bdk rules check .bdk/rules/<ID>.md",
    ]);
  }
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const absolute = (display: string): string =>
    join(display.startsWith(".bdk/") ? projectRoot : deps.pluginRoot, display);
  const within = (display: string): boolean => {
    if (scope === undefined) return true;
    const inside = relative(scope, absolute(display));
    return inside === "" || (!inside.startsWith(`..${sep}`) && inside !== "..");
  };
  const problems = context.problems.filter((problem) =>
    problem.file === "rules.disabled" ? scope === undefined : within(problem.file),
  );
  const refusal = formatRefusal(problems);
  if (refusal !== undefined) return refusal;
  const rules = context.rules.filter((rule) => within(rule.file));
  return {
    valid: true,
    rules: rules.length,
    bundle: rules.filter((rule) => rule.scope === "bundle").length,
    project: rules.filter((rule) => rule.scope === "project").length,
    tombstones: rules.filter((rule) => rule.removed !== undefined).length,
  };
}

/** The refusal of the first problem, duplicates first; undefined without problems. */
export function formatRefusal(problems: readonly RuleProblem[]): Refusal | undefined {
  const ordered = [
    ...problems.filter((problem) => problem.code === "duplicate-id"),
    ...problems.filter((problem) => problem.code !== "duplicate-id"),
  ];
  const first = ordered[0];
  if (first === undefined) return undefined;
  const more = ordered.length - 1;
  const where = first.line === undefined ? first.file : `${first.file}:${String(first.line)}`;
  const tail = more === 0 ? "" : ` (${String(more)} more problems)`;
  return refuse(
    first.code === "duplicate-id" ? "policy/duplicate-rule-id" : "policy/rule-format",
    `${first.code} at ${where}: ${first.message}${tail}`,
    [
      first.file === "rules.disabled"
        ? "fix rules.disabled in .bdk/settings.yaml"
        : `fix ${first.file}`,
      "bdk rules check",
    ],
  );
}
