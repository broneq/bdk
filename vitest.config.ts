import { globSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// One suite for the whole workspace: root tests, scripts, the docs site helpers and every
// plugin's tests.
export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "scripts/**/*.test.ts",
      "plugins/*/src/**/*.test.ts",
      "plugins/*/tests/**/*.test.ts",
      "docs/.vitepress/**/*.test.ts",
    ],
    // A plugin whose tests need a step first (bdk-skill-kit builds the bundles
    // its CLI tests run) ships plugins/<name>/vitest.setup.ts; each runs once
    // before any test file.
    globalSetup: globSync("plugins/*/vitest.setup.ts", { cwd: import.meta.dirname }).map((path) =>
      join(import.meta.dirname, path),
    ),
    // CLI tests spawn Node processes.
    testTimeout: 30_000,
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary"],
      include: ["plugins/*/src/**/*.ts"],
      exclude: ["plugins/*/src/**/*.test.ts", "plugins/bdk-skill-kit/src/cli.ts"],
      thresholds: {
        "plugins/bdk-skill-kit/src/**": { lines: 90, functions: 90, statements: 90, branches: 85 },
      },
    },
  },
});
