// `kernel-architecture`, Continuous integration: a step whose result depends
// only on the source and the lockfile runs once in the `static` job; the steps
// that execute kernel code run on every line of the Node matrix. Steps are
// matched by their `run` command, so renaming a step does not hide a move.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { REPO_ROOT } from "../support/run.ts";

interface Step {
  run?: string;
  with?: Record<string, unknown>;
}

interface Job {
  strategy?: { matrix?: { node?: string[] } };
  steps: Step[];
}

const workflow = parse(
  readFileSync(join(REPO_ROOT, ".github", "workflows", "tests.yml"), "utf8"),
) as { jobs: Record<string, Job> };

const STATIC_COMMANDS = [
  "pnpm lint",
  "pnpm format:check",
  "pnpm typecheck",
  "pnpm knip",
  // The build determinism check compares checksums of a second build.
  "sha256sum",
];
const RUNTIME_COMMANDS = ["pnpm test:unit", "pnpm test:e2e", "pnpm test:contract"];

function job(name: string): Job {
  const found = workflow.jobs[name];
  if (found === undefined) throw new Error(`tests.yml has no ${name} job`);
  return found;
}

function runs(target: Job): string {
  return target.steps.map((step) => step.run ?? "").join("\n");
}

describe("tests.yml job split", () => {
  it("runs the Node-independent checks in the static job on .nvmrc", () => {
    const steps = job("static").steps;
    const setupNode = steps.find((step) => step.with?.["node-version-file"] !== undefined);
    expect(setupNode?.with?.["node-version-file"]).toBe(".nvmrc");
    for (const command of STATIC_COMMANDS) expect(runs(job("static"))).toContain(command);
  });

  it("runs the runtime suites on every line of the Node matrix", () => {
    const kernel = job("kernel");
    expect(kernel.strategy?.matrix?.node).toStrictEqual(["22.13", "24", "26"]);
    for (const command of RUNTIME_COMMANDS) expect(runs(kernel)).toContain(command);
  });

  it("runs no Node-independent check on the matrix", () => {
    const kernel = runs(job("kernel"));
    expect(STATIC_COMMANDS.filter((command) => kernel.includes(command))).toStrictEqual([]);
  });
});
