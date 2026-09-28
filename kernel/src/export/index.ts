// The export slice (`kernel-cli/export`): host projections. A leaf: it imports
// only `shared/`, and no other slice imports it.
import type { Registration } from "../shared/registry/index.ts";
import { agentsCommand } from "./commands/agents.ts";
import type { ExportDeps } from "./use-cases/agents.ts";

export type { ExportDeps } from "./use-cases/agents.ts";

export function exportRegistrations(deps: ExportDeps): Registration[] {
  return [{ id: "export-agents", handler: agentsCommand(deps) }];
}
