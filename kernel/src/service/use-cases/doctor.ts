// The Node floor, the v2 layout (T11) and the settings schema checks (T12).
// The merge-hash and index freshness checks join with their owner tasks (T30,
// T14, T20); each adds one finding with exactly one repair (R-14).
import { meetsNodeMinimum, NODE_INSTALL, NODE_MINIMUM } from "../../shared/registry/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { detectLayout } from "../../config/index.ts";
import { layoutFinding } from "../domain/layout.ts";
import type { DoctorReport, Finding } from "../domain/report.ts";
import { schemaFindings } from "./schema-checks.ts";
import type { VersionInput } from "./version.ts";
import { version } from "./version.ts";

export interface DoctorInput extends VersionInput {
  readonly settings: ConfigRegistry;
  readonly cwd: string;
  readonly workTree: string;
  /** Apply the repairs that need no system change, then report what remains. */
  readonly fix: boolean;
}

export function doctor(input: DoctorInput): DoctorReport {
  const findings: Finding[] = [];
  if (!meetsNodeMinimum(input.nodeVersion)) {
    findings.push({
      id: "node-version",
      level: "fail",
      summary: `Node ${input.nodeVersion} is below ${NODE_MINIMUM}; node:sqlite needs a flag`,
      repair: NODE_INSTALL[0],
    });
  }

  const root = findProjectRoot(input.store, input.cwd, input.workTree);
  const { layout, present } = detectLayout(input.store, root);
  const finding = layoutFinding(present);
  if (finding !== undefined) findings.push(finding);
  findings.push(...schemaFindings({ ...input, root }));

  return {
    ok: findings.every((item) => item.level === "ok"),
    version: version(input),
    layout,
    findings,
  };
}
