// The measure slice (`kernel-cli/change`, bdk measure): diff signals for the
// caller's own classification. A leaf: no other slice imports it.
import type { Registration } from "../shared/registry/index.ts";
import { measureCommand } from "./commands/measure.ts";
import type { MeasureDeps } from "./use-cases/measure.ts";

export type { MeasureDeps } from "./use-cases/measure.ts";
export { measure } from "./use-cases/measure.ts";

export function measureRegistrations(deps: MeasureDeps): Registration[] {
  return [{ id: "measure", handler: measureCommand(deps) }];
}
