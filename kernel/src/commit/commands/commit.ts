// The commit handler: arguments in, use case, `--json` object or text out.
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, Handler } from "../../shared/registry/index.ts";
import { renderCommit } from "../render/commit.ts";
import { commitTask } from "../use-cases/commit.ts";
import type { CommitDeps } from "../use-cases/deps.ts";

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("commit is Change-scoped");
  return change;
}

export function commitCommand(deps: CommitDeps): Handler {
  return async (context) => {
    const message = context.flags["--message"];
    const report = await commitTask(deps, active(context.change), {
      target: context.positionals["<task|change-id>"] ?? "",
      message: typeof message === "string" ? message : undefined,
    });
    return isRefusal(report) ? report : { data: report, text: renderCommit(report) };
  };
}
