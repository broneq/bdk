// The part slice (`kernel-cli/part`, `kernel-loops`): `list`, `start`,
// `done` and `split` over the plan parts. `attempt close` and `commit` run
// its diff check, `commit` its tiny guard, and `attempt open` reads the
// targets through it.
import type { Registration } from "../shared/registry/index.ts";
import { doneCommand, listCommand, splitCommand, startCommand } from "./commands/part.ts";
import type { PartDeps } from "./use-cases/deps.ts";

export type { PartDeps } from "./use-cases/deps.ts";
export { diffCheck } from "./use-cases/diff.ts";
export type { DiffTarget } from "./use-cases/diff.ts";
export { partItems } from "./use-cases/list.ts";
export { tinyGuard } from "./use-cases/tiny.ts";
export { workTargets } from "./use-cases/targets.ts";
export type { WorkTargets } from "./use-cases/targets.ts";

export function partRegistrations(deps: PartDeps): Registration[] {
  return [
    { id: "part-list", handler: listCommand(deps) },
    { id: "part-start", handler: startCommand(deps) },
    { id: "part-done", handler: doneCommand(deps) },
    { id: "part-split", handler: splitCommand(deps) },
  ];
}
