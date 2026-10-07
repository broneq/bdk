// `bdk plan check <dir>`: the parts of a plan checked against the configured part limits
// (spec `bdk-cli/plan`; design D4, D5). Plan faults are the answer; only a missing directory
// and a missing or invalid configuration are errors.

import { loadConfig } from "../../config/index.ts";
import type { ConfigDeps } from "../../config/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import { checkPlan } from "../domain/check.ts";
import type { Limits } from "../domain/check.ts";
import { readPart } from "../domain/part.ts";
import type { CheckResult } from "../schema/check.ts";
import { readPartFiles } from "../store/parts.ts";

/** What the plan slice needs from the OS: the configuration's and the file system. */
export type PlanDeps = ConfigDeps;

const MISSING = { settings: ".bdk/settings.yaml", openspec: "openspec/" } as const;

function limits(deps: PlanDeps): Limits {
  const config = loadConfig(deps);
  if (config.status === "not-configured") {
    throw new CliError(
      "env/not-configured",
      `BDK is not configured in ${config.root}: ${config.missing.map((name) => MISSING[name]).join(" and ")} missing`,
      "Run /bdk:setup.",
    );
  }
  if (config.status === "invalid") {
    const count = config.problems.length;
    throw new CliError(
      "env/config-invalid",
      `the BDK configuration has ${String(count)} problem${count === 1 ? "" : "s"}`,
      "Run bdk config check.",
    );
  }
  const part = config.settings.plan.part;
  return { maxTasks: part["max-tasks"], maxFiles: part["max-files"], maxBytes: part["max-bytes"] };
}

export function check(deps: PlanDeps, dir: string): CheckResult {
  const applied = limits(deps);
  const { parts, strays } = readPartFiles(deps.files, deps.cwd, dir);
  const checked = checkPlan(
    parts.map(({ id, text }) => readPart(id, text)),
    strays,
    applied,
  );
  return {
    ok: checked.problems.length === 0,
    limits: applied,
    parts: checked.parts.map((part) => ({ ...part, dependsOn: [...part.dependsOn] })),
    waves: checked.waves.map((wave) => ({ ...wave, parts: [...wave.parts] })),
    problems: checked.problems.map((problem) => ({ ...problem, parts: [...problem.parts] })),
  };
}
