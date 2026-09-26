import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { renderSkillExists } from "../render/skill-exists.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { findSkill } from "../use-cases/skill-exists.ts";

export function skillExistsCommand(deps: HooksDeps): Handler {
  return (context) => {
    const name = context.positionals["<name>"] ?? "";
    const foundIn = findSkill(
      {
        store: deps.store,
        home: context.runtime.home,
        projectRoot: findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd),
      },
      name,
    );
    const report = renderSkillExists(name, foundIn);
    return { data: report, text: report.content };
  };
}
