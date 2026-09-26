// The config slice (`kernel-cli/config`): `show`, `check`, `schema` and `set`
// over the layered configuration of `shared/config`.
import type { Registration } from "../shared/registry/index.ts";
import { checkCommand } from "./commands/check.ts";
import { schemaCommand } from "./commands/schema.ts";
import { setCommand } from "./commands/set.ts";
import { showCommand } from "./commands/show.ts";
import type { ConfigDeps } from "./use-cases/input.ts";

export type { ConfigDeps } from "./use-cases/input.ts";
export { detectLayout } from "./use-cases/layout.ts";
export { inspectConfig } from "./use-cases/check.ts";

export function configRegistrations(deps: ConfigDeps): Registration[] {
  return [
    { id: "config-show", handler: showCommand(deps) },
    { id: "config-check", handler: checkCommand(deps) },
    { id: "config-schema", handler: schemaCommand(deps) },
    { id: "config-set", handler: setCommand(deps) },
  ];
}
