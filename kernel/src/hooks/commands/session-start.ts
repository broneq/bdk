import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderSessionStart } from "../render/session-start.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { endStaleAgents } from "../use-cases/lifecycle.ts";
import { sessionStart } from "../use-cases/session-start.ts";
import { hookPlace } from "./agent-hooks.ts";

/** Standalone; the SessionStart payload on stdin gives the session whose agents stay (T41-D6). */
export function sessionStartCommand(deps: HooksDeps): Handler {
  return async (context) => {
    await endStaleAgents(deps, hookPlace(context), context.runtime.readStdin());
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
