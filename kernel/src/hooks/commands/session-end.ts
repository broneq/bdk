import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { sessionEnd } from "../use-cases/session-end.ts";

/** Not Change-scoped: without a Change the checkpoint is reported as skipped. */
export function sessionEndCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const report = await sessionEnd(
      deps,
      {
        cwd: context.cwd,
        workTree: context.workTree ?? context.cwd,
        globalDir: globalDir(context.runtime),
      },
      context.runtime.readStdin(),
    );
    return { data: report, text: report.content };
  };
}
