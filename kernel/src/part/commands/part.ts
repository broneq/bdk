// The four part handlers: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, Handler } from "../../shared/registry/index.ts";
import { renderDone, renderList, renderSplit, renderStart } from "../render/part.ts";
import type { PartDeps } from "../use-cases/deps.ts";
import { donePart } from "../use-cases/done.ts";
import { listParts } from "../use-cases/list.ts";
import { splitPart } from "../use-cases/split.ts";
import { startPart } from "../use-cases/start.ts";

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("this part command is Change-scoped");
  return change;
}

export function listCommand(deps: PartDeps): Handler {
  return async (context) => {
    const report = await listParts(deps, active(context.change), globalDir(context.runtime));
    return isRefusal(report) ? report : { data: report, text: renderList(report) };
  };
}

export function startCommand(deps: PartDeps): Handler {
  return async (context) => {
    const report = await startPart(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<part>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderStart(report) };
  };
}

export function doneCommand(deps: PartDeps): Handler {
  return async (context) => {
    const report = await donePart(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<part>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderDone(report) };
  };
}

export function splitCommand(deps: PartDeps): Handler {
  return async (context) => {
    const report = await splitPart(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<part>"] ?? "",
      context.positionals["<task-ids>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderSplit(report) };
  };
}
