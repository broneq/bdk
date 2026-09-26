import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderSessionStart } from "../render/session-start.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { sessionStart } from "../use-cases/session-start.ts";

/** Standalone; the SessionStart payload on stdin is not read until T24 needs `source`. */
export function sessionStartCommand(deps: HooksDeps): Handler {
  return (context) => {
    const report = renderSessionStart(
      sessionStart({
        ...deps,
        cwd: context.cwd,
        workTree: context.workTree ?? context.runtime.workTree(context.cwd),
        globalDir: globalDir(context.runtime),
      }),
    );
    return { data: report, text: report.content };
  };
}
