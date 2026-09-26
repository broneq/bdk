import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { renderContext } from "../render/sections.ts";
import type { CtxDeps } from "../use-cases/input.ts";
import { composeSkill } from "../use-cases/skill.ts";

export function skillCommand(deps: CtxDeps): Handler {
  return (context) => {
    const outcome = composeSkill(
      {
        ...deps,
        globalDir: globalDir(context.runtime),
        projectRoot: findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd),
        which: (name) => context.runtime.which(name),
      },
      context.positionals["<name>"] ?? "",
    );
    if ("refused" in outcome) return outcome;
    const report = renderContext(outcome);
    return { data: report, text: report.content };
  };
}
