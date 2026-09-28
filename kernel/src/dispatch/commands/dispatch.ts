// The dispatch handlers: positionals in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderBuild, renderShow } from "../render/dispatch.ts";
import { buildPackage } from "../use-cases/build.ts";
import type { DispatchDeps } from "../use-cases/deps.ts";
import { showPackage } from "../use-cases/show.ts";

export function buildCommand(deps: DispatchDeps): Handler {
  return async (context) => {
    if (context.change === undefined) throw new Error("dispatch build is Change-scoped");
    const report = await buildPackage(deps, context.change, globalDir(context.runtime), {
      target: context.positionals["<target>"] ?? "",
      role: context.positionals["<role>"] ?? "",
      ticket: context.positionals["<ticket>"] ?? "",
    });
    return isRefusal(report) ? report : { data: report, text: renderBuild(report) };
  };
}

export function showCommand(deps: DispatchDeps): Handler {
  return (context) => {
    if (context.change === undefined) throw new Error("dispatch show is Change-scoped");
    const report = showPackage(
      deps,
      context.change,
      context.cwd,
      context.positionals["<ticket|path>"] ?? "",
    );
    return Promise.resolve(isRefusal(report) ? report : { data: report, text: renderShow(report) });
  };
}
