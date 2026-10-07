// The kit checks its own skill with every generic rule at error, in the
// claude-code profile that `skill-check` needs (it runs the bundled CLI
// through ${CLAUDE_PLUGIN_ROOT}).
import { defineConfig } from "./src/index.ts";

export default defineConfig({
  targets: [{ kind: "skills", dirs: ["skills"] }],
  rules: {
    "description-front-loaded": "error",
    "reasoning-prompts": "error",
    layout: ["error", { allowed: ["references"] }],
  },
});
