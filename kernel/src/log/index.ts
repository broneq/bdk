// The log slice (`kernel-cli/log`): `add`, `list`, `show` and `resolve` over
// the Change's ledger. `appendEntry` is the one writer of entries; the
// `change` slice calls it for its kernel entries.
import type { Registration } from "../shared/registry/index.ts";
import { addCommand, listCommand, resolveCommand, showCommand } from "./commands/log.ts";
import type { LogDeps } from "./use-cases/deps.ts";

export type { LogDeps } from "./use-cases/deps.ts";
export { withChangeIndex } from "./use-cases/deps.ts";
export { appendEntry } from "./use-cases/append.ts";

export function logRegistrations(deps: LogDeps): Registration[] {
  return [
    { id: "log-add", handler: addCommand(deps) },
    { id: "log-list", handler: listCommand(deps) },
    { id: "log-show", handler: showCommand(deps) },
    { id: "log-resolve", handler: resolveCommand(deps) },
  ];
}
