// Lint for every TypeScript file in the workspace. Formatting is Prettier's job:
// eslint-config-prettier switches off every rule that would fight it.
import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

import { architecture } from "./plugins/bdk/eslint.architecture.ts";
import { SHARED, SLICES } from "./plugins/bdk/src/slices.ts";

export default tseslint.config(
  includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),
  {
    ignores: ["openspec/changes/archive/"],
  },
  {
    // Plugin hooks stay plain .mjs with JSDoc types (no build step); their
    // plugin tsconfig sets checkJs, so the typed rules apply to them too.
    files: ["**/*.ts", "plugins/*/hooks/**/*.mjs"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  prettier,
  // The slice architecture of the bdk CLI (spec bdk-cli), generated from its slice matrix.
  ...architecture({
    cwd: import.meta.dirname,
    srcDir: "plugins/bdk/src",
    slices: SLICES,
    shared: SHARED,
  }),
);
