// The `openspec` command group (spec `bdk-cli/openspec`): installs the BDK OpenSpec schema the
// plugin ships into a project. OpenSpec itself stays the owner of the project's `openspec/`.

import type { Group } from "../shared/cli/index.ts";
import { installCommand } from "./commands/install.ts";
import type { OpenspecDeps } from "./use-cases/install.ts";

export type { OpenspecDeps } from "./use-cases/install.ts";

export function openspecGroup(deps: OpenspecDeps): Group {
  return {
    name: "openspec",
    summary: "The BDK OpenSpec schema in a project",
    commands: [installCommand(deps)],
  };
}
