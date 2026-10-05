import { defineConfig } from "vitest/config";

// Four projects (design D-2 of v3-t11-kernel-skeleton): `unit` runs the
// slices' and the eval harness's tests from source with coverage thresholds, `e2e` runs the committed
// bundle in child processes, `contract` runs the contract, structure and
// dependency tests and the docs site guards over the whole repository, and
// `perf` runs the wall-clock budgets through the bundle. CI does not run
// `perf`: its runners are too noisy for timing assertions.
// Every git a test runs inherits this: `git commit` starts a detached
// `git maintenance run --auto`, which on recent git writes under
// `.git/objects/pack` while a test removes the repository (ENOTEMPTY).
const env = {
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "maintenance.auto",
  GIT_CONFIG_VALUE_0: "false",
  GIT_CONFIG_KEY_1: "gc.auto",
  GIT_CONFIG_VALUE_1: "0",
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          env,
          include: [
            "kernel/src/**/*.test.ts",
            "kernel/tests/support/**/*.test.ts",
            "evals/harness/**/*.test.ts",
            "evals/suites/**/*.test.ts",
          ],
          // Hidden acceptance tests are fixture code, run inside a fixture copy.
          exclude: ["evals/suites/*/hidden/**"],
        },
      },
      {
        test: { name: "e2e", env, include: ["kernel/**/*.e2e.ts"], testTimeout: 30_000 },
      },
      {
        // One file at a time: a budget measured next to another file's child processes measures the contention.
        test: {
          name: "perf",
          env,
          include: ["kernel/**/*.perf.ts"],
          testTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "contract",
          env,
          include: [
            "kernel/tests/contract/**/*.test.ts",
            "kernel/tests/docs/**/*.test.ts",
            "kernel/tests/*.test.ts",
          ],
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["kernel/src/**/*.ts", "evals/harness/**/*.ts", "evals/suites/**/*.ts"],
      exclude: [
        "kernel/src/**/tests/**",
        "kernel/src/main.ts",
        "evals/**/*.test.ts",
        "evals/harness/main.ts",
        // Wrappers around the Agent SDK and the promptfoo binary: exercised
        // by `pnpm eval check` in CI and by measured runs, not unit tests.
        "evals/harness/judge.ts",
        "evals/harness/tools.ts",
        "evals/suites/*/hidden/**",
      ],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
