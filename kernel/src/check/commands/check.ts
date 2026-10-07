// The check handler: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, FlagValue, Handler } from "../../shared/registry/index.ts";
import { renderCheckRun } from "../render/check.ts";
import type { CheckDeps } from "../use-cases/deps.ts";
import { runChecks } from "../use-cases/run.ts";

function list(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("check run is Change-scoped");
  return change;
}

export function checkRunCommand(deps: CheckDeps): Handler {
  return async (context) => {
    const ticket = context.flags["--ticket"];
    const report = await runChecks(
      deps,
      active(context.change),
      { globalDir: globalDir(context.runtime) },
      {
        target: context.positionals["<task|part|change-id>"] ?? "",
        ticket: typeof ticket === "string" ? ticket : "",
        skip: list(context.flags["--skip"]),
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderCheckRun(report) };
  };
}
