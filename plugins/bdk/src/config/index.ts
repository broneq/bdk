// The config slice (spec `bdk-cli/config`): the `bdk config` command group, and the resolved
// configuration for other slices.

import type { Group } from "../shared/cli/index.ts";
import { checkCommand } from "./commands/check.ts";
import { setCommand } from "./commands/set.ts";
import { showCommand } from "./commands/show.ts";
import type { ConfigDeps } from "./use-cases/load.ts";

export { RULE_KINDS, RULE_STAGES } from "./domain/settings.ts";
export type { Settings } from "./domain/settings.ts";
export type { Problem } from "./domain/validate.ts";
export { loadConfig } from "./use-cases/load.ts";
export type { ConfigDeps, ConfigState } from "./use-cases/load.ts";

export function configGroup(deps: ConfigDeps): Group {
  return {
    name: "config",
    summary: "Show, check and set the BDK configuration",
    commands: [showCommand(deps), checkCommand(deps), setCommand(deps)],
  };
}
