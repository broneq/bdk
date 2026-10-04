import type { Handler } from "../../shared/registry/index.ts";
import { renderCraft } from "../render/craft.ts";
import { readCraft } from "../use-cases/craft.ts";
import type { CtxDeps } from "../use-cases/input.ts";

/** Standalone: no work tree and no configuration (`kernel-cli/ctx`, bdk ctx craft). */
export function craftCommand(deps: CtxDeps): Handler {
  return (context) => {
    const skill = readCraft(
      { store: deps.store, pluginRoot: deps.pluginRoot, home: context.runtime.home },
      context.positionals["<name>"] ?? "",
    );
    if ("refused" in skill) return skill;
    const report = renderCraft(skill);
    return { data: report, text: report.content };
  };
}
