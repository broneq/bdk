// The spec handlers: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, Handler } from "../../shared/registry/index.ts";
import { renderCheck, renderDiff, renderMerge } from "../render/spec.ts";
import { checkDeltas } from "../use-cases/check.ts";
import type { SpecDeps } from "../use-cases/deps.ts";
import { diffSpecs } from "../use-cases/diff.ts";
import { mergeSpecs } from "../use-cases/merge.ts";

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("spec commands are Change-scoped");
  return change;
}

export function deltaCheckCommand(deps: SpecDeps): Handler {
  return (context) => {
    const report = checkDeltas(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<capability>"],
    );
    return isRefusal(report) ? report : { data: report, text: renderCheck(report) };
  };
}

export function mergeCommand(deps: SpecDeps): Handler {
  return async (context) => {
    const dryRun = context.flags["--dry-run"] === true;
    const report = await mergeSpecs(
      deps,
      active(context.change),
      globalDir(context.runtime),
      dryRun,
    );
    return isRefusal(report) ? report : { data: report, text: renderMerge(report, dryRun) };
  };
}

export function diffCommand(deps: SpecDeps): Handler {
  return (context) => {
    const report = diffSpecs(deps, active(context.change), context.positionals["<capability>"]);
    return isRefusal(report) ? report : { data: report, text: renderDiff(report) };
  };
}
