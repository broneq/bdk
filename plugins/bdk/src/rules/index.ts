// The `rules` command group (spec `bdk-cli/rules`): the rules of the BDK pack and the project
// that a role of a stage reads for its files (spec `rule-pack`).

import type { Group } from "../shared/cli/index.ts";
import { forCommand } from "./commands/for.ts";
import type { RulesDeps } from "./use-cases/for.ts";

export type { RulesDeps } from "./use-cases/for.ts";

export function rulesGroup(deps: RulesDeps): Group {
  return {
    name: "rules",
    summary: "The rules a role reads for its stage and files",
    commands: [forCommand(deps)],
  };
}
