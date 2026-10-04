// The dispatch slice (`kernel-cli/dispatch`): `build` writes a ticket's
// package from the one template, `show` prints it to the agent.
import type { Registration } from "../shared/registry/index.ts";
import { buildCommand, showCommand } from "./commands/dispatch.ts";
import type { DispatchDeps } from "./use-cases/deps.ts";

export type { DispatchDeps } from "./use-cases/deps.ts";

export function dispatchRegistrations(deps: DispatchDeps): Registration[] {
  return [
    { id: "dispatch-build", handler: buildCommand(deps) },
    { id: "dispatch-show", handler: showCommand(deps) },
  ];
}
