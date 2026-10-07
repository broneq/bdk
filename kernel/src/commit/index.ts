// The commit slice (`kernel-cli/commit`): the review fix commit with the BDK
// trailers after the diff check of `part`.
import type { Registration } from "../shared/registry/index.ts";
import { commitCommand } from "./commands/commit.ts";
import type { CommitDeps } from "./use-cases/deps.ts";

export function commitRegistrations(deps: CommitDeps): Registration[] {
  return [{ id: "commit", handler: commitCommand(deps) }];
}
