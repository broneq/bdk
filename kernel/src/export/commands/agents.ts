import { resolve } from "node:path";

import type { Handler } from "../../shared/registry/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import { renderAgents } from "../render/agents.ts";
import { exportAgents } from "../use-cases/agents.ts";
import type { ExportDeps, HostId } from "../use-cases/agents.ts";

export function agentsCommand(deps: ExportDeps): Handler {
  return (context) => {
    const host = context.flags["--host"];
    // The registry checks the value list; a flag cannot be marked required.
    if (typeof host !== "string") {
      return refuse(
        "input/missing-argument",
        "--host is required: claude is the only host in 3.0",
        ["bdk export agents --host claude", "bdk export agents --help"],
      );
    }
    const out = context.flags["--out"];
    const report = exportAgents(deps, {
      host: host as HostId,
      ...(typeof out === "string" ? { out: resolve(context.cwd, out) } : {}),
      check: context.flags["--check"] === true,
      root: context.workTree ?? context.cwd,
    });
    return isRefusal(report) ? report : { data: report, text: renderAgents(report) };
  };
}
