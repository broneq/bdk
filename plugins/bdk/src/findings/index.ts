// The `findings` slice (spec `bdk-cli/findings`): the event log of a review round.
import type { Group } from "../shared/cli/index.ts";
import type { Files } from "../shared/fs/index.ts";
import { add } from "./commands/add.ts";
import { decide } from "./commands/decide.ts";
import { level } from "./commands/level.ts";
import { list } from "./commands/list.ts";

export { addFinding } from "./use-cases/add.ts";
export type { AddInput } from "./use-cases/add.ts";
export { listFindings } from "./use-cases/list.ts";
export type { ListInput } from "./use-cases/list.ts";
export type { Finding, View } from "./domain/fold.ts";

export interface FindingsDeps {
  readonly files: Files;
}

export function findingsGroup({ files }: FindingsDeps): Group {
  return {
    name: "findings",
    summary: "Record findings, levels and decisions of a review round; list them folded",
    commands: [add(files), level(files), decide(files), list(files)],
  };
}
