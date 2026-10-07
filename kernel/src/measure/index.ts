// The measure slice (`kernel-cli/change`, bdk measure): diff signals for the
// caller's own classification. Only `review` imports it, for the module
// signals of a review range (T42).
import type { Registration } from "../shared/registry/index.ts";
import { measureCommand } from "./commands/measure.ts";
import type { MeasureDeps } from "./use-cases/measure.ts";

export type { MeasureDeps } from "./use-cases/measure.ts";
export type { FileStat } from "./domain/measure.ts";
export { moduleOf } from "./domain/measure.ts";
export { measure, rangeFiles, rangeStats } from "./use-cases/measure.ts";

export function measureRegistrations(deps: MeasureDeps): Registration[] {
  return [{ id: "measure", handler: measureCommand(deps) }];
}
