import { defineConfig } from "vitest/config";

// One suite for the whole workspace: root tests, scripts and every plugin's tests.
export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "scripts/**/*.test.ts",
      "plugins/*/src/**/*.test.ts",
      "plugins/*/tests/**/*.test.ts",
    ],
  },
});
