// The kit checks its own skills: portable profile, every generic rule at error.
import { defineConfig } from "./src/index.ts";

export default defineConfig({
  targets: [{ kind: "skills", dirs: ["skills"], profile: "portable" }],
  rules: {
    "description-front-loaded": "error",
    layout: ["error", { allowed: ["references"] }],
  },
});
