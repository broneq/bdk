// The change slice (`kernel-cli/change`): `new`, `status`, `list`, `resume`,
// `park`, `takeover` and `checkpoint`. Its ledger entries go through the log
// slice's `appendEntry`, its checkpoint and rebuild through the `shared/store`
// cores.
import type { Registration } from "../shared/registry/index.ts";
import {
  checkpointCommand,
  listCommand,
  newCommand,
  parkCommand,
  resumeCommand,
  statusCommand,
  takeoverCommand,
} from "./commands/change.ts";
import type { ChangeDeps } from "./use-cases/deps.ts";

export type { ChangeDeps } from "./use-cases/deps.ts";

export function changeRegistrations(deps: ChangeDeps): Registration[] {
  return [
    { id: "change-new", handler: newCommand(deps) },
    { id: "change-status", handler: statusCommand(deps) },
    { id: "change-list", handler: listCommand(deps) },
    { id: "change-resume", handler: resumeCommand(deps) },
    { id: "change-park", handler: parkCommand(deps) },
    { id: "change-takeover", handler: takeoverCommand(deps) },
    { id: "change-checkpoint", handler: checkpointCommand(deps) },
  ];
}
