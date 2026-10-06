// The Node floor, the v2 layout (T11), the settings schema checks (T12), the
// living spec hashes (T30-D13), the rule files (T31) and the v2 ignore rule
// (T32). The index freshness check joins with its owner task (T20); each adds
// one finding with exactly one repair (R-14).
import { meetsNodeMinimum, NODE_INSTALL, NODE_MINIMUM } from "../../shared/registry/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { KernelRefusal } from "../../shared/refusal/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { detectLayout } from "../../config/index.ts";
import { ruleHealth } from "../../rules/index.ts";
import { mergeHashFindings } from "../../spec/index.ts";
import { ignoredFinding, parseIgnoreRule, TRACKED_PROBE } from "../domain/ignore.ts";
import { layoutFinding } from "../domain/layout.ts";
import type { DoctorReport, Finding } from "../domain/report.ts";
import { schemaFindings } from "./schema-checks.ts";
import type { VersionInput } from "./version.ts";
import { version } from "./version.ts";

export interface DoctorInput extends VersionInput {
  readonly settings: ConfigRegistry;
  readonly git: Git;
  readonly cwd: string;
  readonly workTree: string;
  /** The global settings directory, which the rule checks resolve settings with. */
  readonly globalDir: string;
  /** Apply the repairs that need no system change, then report what remains. */
  readonly fix: boolean;
}

export async function doctor(input: DoctorInput): Promise<DoctorReport> {
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
  if (layout !== "none") {
    const ignored = await ignoreFinding(input.git, root);
    if (ignored !== undefined) findings.push(ignored);
  }
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

/**
 * `bdk-ignored` when a rule ignores the settings file BDK commits; undefined
 * when none does, or when git is missing or cannot answer (as `ensureIgnored`).
 */
async function ignoreFinding(git: Git, root: string): Promise<Finding | undefined> {
  try {
    const result = await git.run(["check-ignore", "--no-index", "--verbose", TRACKED_PROBE], root);
    if (result.code !== 0) return undefined;
    const rule = parseIgnoreRule(result.stdout);
    return rule === undefined ? undefined : ignoredFinding(rule);
  } catch (error) {
    if (error instanceof KernelRefusal && error.refusal.rule === "runtime/git-missing") {
      return undefined;
    }
    throw error;
  }
}

function ruleFindings(input: DoctorInput, root: string): Finding[] {
  const invalid = ruleHealth(input, root, input.globalDir);
  if (invalid === undefined) return [];
  return [{ id: "rules-invalid", level: "fail", summary: invalid, repair: "bdk rules check" }];
}
