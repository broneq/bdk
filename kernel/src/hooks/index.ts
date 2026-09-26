// The hooks slice (`kernel-cli/hooks`): the content hooks of T13. The guards
// and `session-end` land with T24.
import type { Registration } from "../shared/registry/index.ts";
import { sessionStartCommand } from "./commands/session-start.ts";
import { skillExistsCommand } from "./commands/skill-exists.ts";
import type { HooksDeps } from "./use-cases/input.ts";

export type { HooksDeps } from "./use-cases/input.ts";

export function hooksRegistrations(deps: HooksDeps): Registration[] {
  return [
    { id: "hooks-session-start", handler: sessionStartCommand(deps) },
    { id: "hooks-skill-exists", handler: skillExistsCommand(deps) },
  ];
}
