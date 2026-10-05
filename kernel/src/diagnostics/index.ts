// The diagnostics slice (`kernel-cli/diagnostics`; design of
// v3-t47-run-diagnostics): the run journal and the host transcripts read into
// a deterministic report, the verbose render, bounded slices, and the checked
// store of an analysis. A leaf: `hooks` imports it for the live log and the session-end render.
import type { Registration } from "../shared/registry/index.ts";
import { logCommand, reportCommand, sliceCommand, writeCommand } from "./commands/diagnostics.ts";
import { outlierFactorModule, repeatReadModule, repeatRefusalModule } from "./config.ts";
import type { DiagnosticsDeps } from "./use-cases/report.ts";

export { liveLines } from "./domain/live.ts";
export { writeSessionLog } from "./use-cases/log.ts";
export { appendLiveLog } from "./use-cases/logs.ts";

export type { DiagnosticsDeps } from "./use-cases/report.ts";

export const diagnosticsConfig = {
  modules: [repeatRefusalModule, repeatReadModule, outlierFactorModule],
  prompts: [],
};

export function diagnosticsRegistrations(deps: DiagnosticsDeps): Registration[] {
  return [
    { id: "diagnostics-report", handler: reportCommand(deps) },
    { id: "diagnostics-log", handler: logCommand(deps) },
    { id: "diagnostics-slice", handler: sliceCommand(deps) },
    { id: "diagnostics-write", handler: writeCommand(deps) },
  ];
}
