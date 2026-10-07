// `bdk run status`: no arguments, no flags of its own.

import type { Command } from "../../shared/cli/index.ts";
import { renderStatus } from "../render/status.ts";
import { status } from "../use-cases/status.ts";
import type { RunDeps } from "../use-cases/status.ts";

export function statusCommand(deps: RunDeps): Command {
  return {
    verb: "status",
    summary: "Render the run, the parts of the current Change and the open stage of each Change",
    run() {
      const result = status(deps);
      return { data: result, text: renderStatus(result) };
    },
  };
}
