// The four graph handlers: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Rule } from "../../shared/refusal/index.ts";
import type { ActiveChange, Handler } from "../../shared/registry/index.ts";
import { renderDone, renderExplain, renderNext, renderValidate } from "../render/graph.ts";
import type { GraphDeps } from "../use-cases/deps.ts";
import { markDone } from "../use-cases/done.ts";
import { explainNode } from "../use-cases/explain.ts";
import { nextStep } from "../use-cases/next.ts";
import { validateNode } from "../use-cases/validate.ts";

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("this graph command is Change-scoped");
  return change;
}

export function nextCommand(deps: GraphDeps): Handler {
  return async (context) => {
    const outcome = await nextStep(deps, active(context.change), globalDir(context.runtime));
    return isRefusal(outcome) ? outcome : { data: outcome.report, text: renderNext(outcome) };
  };
}

export function explainCommand(deps: GraphDeps): Handler {
  return async (context) => {
    const report = await explainNode(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<artifact>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderExplain(report) };
  };
}

export function validateCommand(deps: GraphDeps): Handler {
  return async (context) => {
    const report = await validateNode(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<artifact>"],
    );
    if (isRefusal(report)) return report;
    const failed = report.checks.find((check) => !check.ok);
    if (!context.json && failed !== undefined) {
      return refuse(
        (failed.rule ?? "policy/validation-failed") as Rule,
        `${renderValidate(report)}${report.artifact} fails check ${failed.id}: ${failed.why ?? "failed"}`,
        [
          ...(failed.instead === undefined ? [] : [failed.instead]),
          `bdk validate ${report.artifact} --json`,
        ],
      );
    }
    return { data: report, text: renderValidate(report) };
  };
}

export function doneCommand(deps: GraphDeps): Handler {
  return async (context) => {
    const report = await markDone(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<artifact>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderDone(report) };
  };
}
