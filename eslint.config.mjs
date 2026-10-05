// Lint for the kernel and eval harness sources and tests, and the docs site config. Formatting is Prettier's job:
// eslint-config-prettier switches off every rule that would fight it.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
      "docs/guide/.vitepress/dist/",
      "docs/guide/.vitepress/cache/",
      "evals/.runs/",
      "evals/suites/*/hidden/",
    ],
  },
  {
    files: ["kernel/**/*.ts", "evals/**/*.ts", "docs/guide/.vitepress/**/*.ts"],
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
);
