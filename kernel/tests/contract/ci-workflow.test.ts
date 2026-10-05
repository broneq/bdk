// `kernel-architecture`, Continuous integration: a step whose result depends
// only on the source and the lockfile runs once in the `static` job; the steps
// that execute kernel code run on every line of the Node matrix, E2E in its
// own job split into shards. Steps are matched by their `run` command, so
// renaming a step does not hide a move.
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
  strategy?: { matrix?: { node?: string[]; shard?: number[] } };
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
const NODE_LINES = ["22.13", "24", "26"];
const KERNEL_COMMANDS = ["pnpm test:unit", "pnpm test:contract"];

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

  it("runs unit and contract on every line of the Node matrix, E2E elsewhere", () => {
    const kernel = job("kernel");
    expect(kernel.strategy?.matrix?.node).toStrictEqual(NODE_LINES);
    for (const command of KERNEL_COMMANDS) expect(runs(kernel)).toContain(command);
    expect(runs(kernel)).not.toContain("pnpm test:e2e");
  });

  it("runs E2E on every line of the Node matrix in two shards", () => {
    const e2e = job("e2e");
    expect(e2e.strategy?.matrix?.node).toStrictEqual(NODE_LINES);
    expect(e2e.strategy?.matrix?.shard).toStrictEqual([1, 2]);
    expect(runs(e2e)).toContain("pnpm test:e2e --shard=${{ matrix.shard }}/2");
  });

  it.each(["kernel", "e2e"])("runs no Node-independent check in the %s job", (name) => {
    const matrix = runs(job(name));
    expect(STATIC_COMMANDS.filter((command) => matrix.includes(command))).toStrictEqual([]);
  });
});
