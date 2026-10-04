import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, Handler } from "../../shared/registry/index.ts";
import { renderRebuild } from "../render/rebuild.ts";
import { rebuild } from "../use-cases/rebuild.ts";
import type { RebuildDeps } from "../use-cases/rebuild.ts";

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("rebuild is Change-scoped");
  return change;
}

export function rebuildCommand(deps: RebuildDeps): Handler {
  return async (context) => {
    const report = await rebuild(deps, active(context.change), {
      all: context.flags["--all"] === true,
      globalDir: globalDir(context.runtime),
    });
    return isRefusal(report) ? report : { data: report, text: renderRebuild(report) };
  };
}
