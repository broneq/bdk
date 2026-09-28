// The export slice (`kernel-cli/export`): host projections. A leaf: it imports
// only `shared/`; `dispatch` reads the role-to-adapter map from here.
import type { Registration } from "../shared/registry/index.ts";
import { agentsCommand } from "./commands/agents.ts";
import type { ExportDeps } from "./use-cases/agents.ts";

export type { ExportDeps } from "./use-cases/agents.ts";
export { ROLE_ADAPTERS } from "./domain/adapters.ts";

export function exportRegistrations(deps: ExportDeps): Registration[] {
  return [{ id: "export-agents", handler: agentsCommand(deps) }];
}
