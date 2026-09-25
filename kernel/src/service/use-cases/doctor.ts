// The checks T11 ships: the Node floor and the v2 layout. The merge-hash,
// index freshness and schema checks join with their owner tasks (T30, T14,
// T20, T12); each adds one finding with exactly one repair (R-14).
import { join } from "node:path";

import { meetsNodeMinimum, NODE_INSTALL, NODE_MINIMUM } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { classifyLayout, V2_MARKERS } from "../domain/layout.ts";
import type { DoctorOutput, Finding } from "../schema/doctor.ts";
import type { VersionInput } from "./version.ts";
import { version } from "./version.ts";

export interface DoctorInput extends VersionInput {
  readonly cwd: string;
  readonly workTree: string;
}

export function doctor(input: DoctorInput): DoctorOutput {
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
  const { layout, finding } = classifyLayout({
    bdk: input.store.isDirectory(join(root, ".bdk")),
    present: V2_MARKERS.filter((marker) => input.store.exists(join(root, marker))),
  });
  if (finding !== undefined) findings.push(finding);

  return {
    ok: findings.every((item) => item.level === "ok"),
    version: version(input),
    layout,
    findings,
  };
}
