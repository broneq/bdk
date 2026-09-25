// The fixture tree's config: BDK's own settings over three targets, one of each
// kind BDK checks (skills, adapter agents, a portable craft group).
import { defineConfig } from "bdk-skill-kit";

import { rules } from "../../../skill-check.config.ts";
import bdk from "../bdk-rules.ts";

export default defineConfig({
  targets: [
    { kind: "skills", dirs: ["skills"] },
    { kind: "agents", dirs: ["adapters"], rules: { "bdk/adapter-shape": "error" } },
    { kind: "skills", dirs: ["craft"], profile: "portable" },
  ],
  plugins: [bdk],
  rules,
});
