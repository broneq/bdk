// The Node floor, the v2 layout (T11), the settings schema checks (T12), the
// living spec hashes (T30-D13) and the rule files (T31). The index freshness check joins with its
// owner task (T20); each adds one finding with exactly one repair (R-14).
import { meetsNodeMinimum, NODE_INSTALL, NODE_MINIMUM } from "../../shared/registry/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { detectLayout } from "../../config/index.ts";
import { ruleHealth } from "../../rules/index.ts";
import { mergeHashFindings } from "../../spec/index.ts";
import { layoutFinding } from "../domain/layout.ts";
import type { DoctorReport, Finding } from "../domain/report.ts";
import { schemaFindings } from "./schema-checks.ts";
import type { VersionInput } from "./version.ts";
import { version } from "./version.ts";

export interface DoctorInput extends VersionInput {
  readonly settings: ConfigRegistry;
  readonly cwd: string;
  readonly workTree: string;
  /** The global settings directory, which the rule checks resolve settings with. */
  readonly globalDir: string;
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
  for (const found of mergeHashFindings(input.store, root)) {
    findings.push({
      id: "merge-hash",
      level: "fail",
      summary: found.message,
      repair: `git restore --source=$(git log -1 --format=%H --grep='^chore(bdk): close' -- ${found.path}) -- ${found.path}`,
    });
  }

  findings.push(...ruleFindings(input, root));

  return {
    ok: findings.every((item) => item.level === "ok"),
    version: version(input),
    layout,
    findings,
  };
}

function ruleFindings(input: DoctorInput, root: string): Finding[] {
  const health = ruleHealth(input, root, input.globalDir);
  if (health === undefined) return [];
  const findings: Finding[] = health.withoutId.map((file) => ({
    id: "rule-without-id",
    level: "warn",
    summary: `${file} holds rules without an id`,
    repair: "bdk rules import",
  }));
  if (health.invalid !== undefined) {
    findings.push({
      id: "rules-invalid",
      level: "fail",
      summary: health.invalid,
      repair: "bdk rules check",
    });
  }
  if (health.drifted.length > 0) {
    findings.push({
      id: "projection-outdated",
      level: "warn",
      summary: `${health.drifted.join(" and ")} differ${health.drifted.length === 1 ? "s" : ""} from the rules under .bdk/rules/`,
      repair: "bdk rules export --claude",
    });
  }
  return findings;
}
