// The log slice (`kernel-cli/log`): `add`, `ingest`, `list`, `show`, `resolve` and `triage` over
// the Change's ledger. `appendEntry` is the one writer of entries; the
// `change` slice calls it for its kernel entries.
import type { Registration } from "../shared/registry/index.ts";
import {
  addCommand,
  ingestCommand,
  listCommand,
  resolveCommand,
  showCommand,
  triageCommand,
} from "./commands/log.ts";
import { verifierModule } from "./config.ts";
import type { LogDeps } from "./use-cases/deps.ts";

export type { LogDeps } from "./use-cases/deps.ts";
export { withChangeIndex } from "./use-cases/deps.ts";
export { appendEntry } from "./use-cases/append.ts";
export type { AppendResult } from "./domain/entry.ts";
export { verifierLists, verifierPolicy } from "./use-cases/verifier.ts";
export type { VerifierCategory } from "./use-cases/verifier.ts";

export const logConfig = { modules: [verifierModule] };

export function logRegistrations(deps: LogDeps): Registration[] {
  return [
    { id: "log-add", handler: addCommand(deps) },
    { id: "log-ingest", handler: ingestCommand(deps) },
    { id: "log-list", handler: listCommand(deps) },
    { id: "log-show", handler: showCommand(deps) },
    { id: "log-resolve", handler: resolveCommand(deps) },
    { id: "log-triage", handler: triageCommand(deps) },
  ];
}
