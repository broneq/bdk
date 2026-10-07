// The `git` command group: review scope and reviewer groups (spec `bdk-cli/git`).

import type { Group } from "../shared/cli/index.ts";
import { groupsCommand } from "./commands/groups.ts";
import { scopeCommand } from "./commands/scope.ts";
import type { GitDeps } from "./use-cases/deps.ts";

export type { GitDeps } from "./use-cases/deps.ts";

export function gitGroup(deps: GitDeps): Group {
  return {
    name: "git",
    summary: "Review scope and reviewer groups of a branch",
    commands: [scopeCommand(deps), groupsCommand(deps)],
  };
}
