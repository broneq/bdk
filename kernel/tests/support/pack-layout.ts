// The pack layout of `rules/README.md` (Where a rule applies): the stages each
// pack directory fixes and the globs of each language directory. The pack
// contract test checks the shipped files against it; other tests build pack
// stand-ins from it so they select as the shipped pack does.
import type { RuleStage } from "../../src/shared/vocabulary/index.ts";

/** The stages each pack directory fixes: where some reader read it before #153. */
export const PACK_STAGES: Readonly<Record<string, readonly RuleStage[]>> = {
  architecture: ["design", "plan", "execute", "review"],
  security: ["design", "execute", "review"],
  "engineering-judgment": ["design", "plan"],
  plan: ["plan"],
  "test-quality": ["plan", "execute", "review"],
  "code-quality": ["plan", "execute", "review"],
  "design-patterns": ["execute", "review"],
  "languages/javascript": ["plan", "execute", "review"],
  "languages/typescript": ["plan", "execute", "review"],
  "languages/react": ["plan", "execute", "review"],
};

/** The file globs of a language pack; every other directory states `["**"]`. */
export const LANGUAGE_PATHS: Readonly<Record<string, readonly string[]>> = {
  "languages/javascript": ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.jsx"],
  "languages/typescript": ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"],
  "languages/react": ["**/*.jsx", "**/*.tsx"],
};
