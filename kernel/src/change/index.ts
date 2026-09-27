// The change slice (`kernel-cli/change`): `new`, `status`, `list`, `resume`
// and `park`. Its ledger entries go through the log slice's `appendEntry`.
import type { Registration } from "../shared/registry/index.ts";
import {
  listCommand,
  newCommand,
  parkCommand,
  resumeCommand,
  statusCommand,
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
  ];
}
