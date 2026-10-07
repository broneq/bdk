// `bdk openspec install`: no arguments, no flags of its own.

import type { Command } from "../../shared/cli/index.ts";
import { renderInstall } from "../render/install.ts";
import { install } from "../use-cases/install.ts";
import type { OpenspecDeps } from "../use-cases/install.ts";

export function installCommand(deps: OpenspecDeps): Command {
  return {
    verb: "install",
    summary:
      "Copy the BDK OpenSpec schema the plugin ships into openspec/schemas/bdk/ of the working directory",
    run() {
      const result = install(deps);
      return { data: result, text: renderInstall(result) };
    },
  };
}
