// Content checks for BDK's own skills and agents (spec `skill-content-checks`).
import { type Config, defineConfig } from "bdk-skill-kit";

import bdk from "./tools/skill-check/bdk-rules.ts";

// Shared with the fixture config (tools/skill-check/fixtures/), so the seeded
// violations are checked with exactly these settings.
export const rules = {
  "line-limit": ["error", { max: 200 }],
  // BDK's listing budget (.claude/rules/skills.md), below the host cap.
  description: ["error", { max: 250 }],
  "description-front-loaded": "error",
  "require-model": "error",
  layout: ["error", { allowed: ["references", "examples", "scripts", "assets"] }],
} satisfies Config["rules"];

export default defineConfig({
  targets: [
    { kind: "skills", dirs: ["skills"] },
    { kind: "agents", dirs: ["agents"], rules: { "bdk/adapter-shape": "error" } },
  ],
  plugins: [bdk],
  rules,
  // v2 content the v3 tasks rewrite; each entry suppresses one known finding.
  baseline: "tools/skill-check/baseline.json",
});
