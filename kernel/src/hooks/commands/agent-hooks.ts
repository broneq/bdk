import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import type { HookPlace } from "../use-cases/agents.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { mainStop, subagentStop } from "../use-cases/continuation.ts";
import type { StopReport } from "../use-cases/continuation.ts";
import { postTool, subagentStart } from "../use-cases/lifecycle.ts";

type Context = Parameters<Handler>[0];

/** The agent hooks are standalone: the work tree is looked up here, and its absence is no error. */
export function hookPlace(context: Context): HookPlace {
  const workTree = context.workTree ?? context.runtime.workTree(context.cwd);
  return {
    cwd: context.cwd,
    ...(workTree === undefined ? {} : { workTree }),
    globalDir: globalDir(context.runtime),
  };
}

/** Records only: stdout stays empty in text mode. */
export function postToolCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const report = await postTool(deps, hookPlace(context), context.runtime.readStdin());
    return { data: report, text: "" };
  };
}

/** The host's `SubagentStart` context object for a BDK agent; empty otherwise. */
export function subagentStartCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const report = await subagentStart(deps, hookPlace(context), context.runtime.readStdin());
    const text =
      report.context === null
        ? ""
        : JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "SubagentStart",
              additionalContext: report.context,
            },
          });
    return { data: report, text };
  };
}

/** The host's block object on `block`; nothing on `pass` (HOST-FACTS `stop-block`). */
function stopText(report: StopReport): string {
  return report.decision === "block"
    ? JSON.stringify({ decision: "block", reason: report.reason ?? "" })
    : "";
}

export function stopCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const report = await mainStop(deps, hookPlace(context), context.runtime.readStdin());
    return { data: report, text: stopText(report) };
  };
}

export function subagentStopCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const report = await subagentStop(deps, hookPlace(context), context.runtime.readStdin());
    return { data: report, text: stopText(report) };
  };
}
