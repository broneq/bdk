// The `diagnostics` command group (spec `bdk-cli/diagnostics`): counts a run from the host's
// transcripts for /bdk:diagnose-run. It reads; it records nothing during a run (design D4).

import type { Group } from "../shared/cli/index.ts";
import { reportCommand } from "./commands/report.ts";
import type { DiagnosticsDeps } from "./use-cases/report.ts";

export type { DiagnosticsDeps } from "./use-cases/report.ts";

export function diagnosticsGroup(deps: DiagnosticsDeps): Group {
  return {
    name: "diagnostics",
    summary: "Count a run from the host transcripts: time, tokens, cost share and waste",
    commands: [reportCommand(deps)],
  };
}
