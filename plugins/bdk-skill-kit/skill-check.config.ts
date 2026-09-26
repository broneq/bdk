// The kit checks its own skills with every generic rule at error. They sit in
// one directory, so the target uses the claude-code profile that `skill-check`
// needs (it runs the bundled CLI through ${CLAUDE_PLUGIN_ROOT});
// src/skills.test.ts checks `skill-authoring` alone in the portable profile.
import { defineConfig } from "./src/index.ts";

export default defineConfig({
  targets: [{ kind: "skills", dirs: ["skills"] }],
  rules: {
    "description-front-loaded": "error",
    layout: ["error", { allowed: ["references"] }],
  },
});
