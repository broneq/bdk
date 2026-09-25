import { defineConfig } from "vitest/config";

// Three projects (design D-2 of v3-t11-kernel-skeleton): `unit` runs the
// slices' tests from source with coverage thresholds, `e2e` runs the committed
// bundle in child processes, `contract` runs the contract, structure and
// dependency tests over the whole repository.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["kernel/src/**/*.test.ts", "kernel/tests/support/**/*.test.ts"],
        },
      },
      {
        test: { name: "e2e", include: ["kernel/**/*.e2e.ts"], testTimeout: 30_000 },
      },
      {
        test: {
          name: "contract",
          include: ["kernel/tests/contract/**/*.test.ts", "kernel/tests/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["kernel/src/**/*.ts"],
      exclude: ["kernel/src/**/tests/**", "kernel/src/main.ts"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
