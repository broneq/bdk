// `bdk config check` (spec `bdk-cli/config`, "config check").

import type { Command } from "../../shared/cli/index.ts";
import { renderCheck } from "../render/check.ts";
import type { ConfigDeps } from "../use-cases/load.ts";
import { check } from "../use-cases/check.ts";

export function checkCommand(deps: ConfigDeps): Command {
  return {
    verb: "check",
    summary: "Validate every layer file and list each problem with its file and key",
    exits: [{ code: 1, when: "a layer file has a problem" }],
    run() {
      const result = check(deps);
      return {
        data: result,
        text: renderCheck(result),
        ...(result.problems.length > 0 ? { exit: 1 as const } : {}),
      };
    },
  };
}
