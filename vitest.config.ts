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
  },
});
