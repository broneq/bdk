// Every plugin's skills and agents, checked in strict mode by tests/skill-check.test.ts
// (spec repo-sdlc; v3-415-skill-check-ci). Plugins are found by listing plugins/, so a new
// one is checked without an edit here. The kit's own skill also keeps its stricter
// self-check, plugins/bdk-skill-kit/skill-check.config.ts.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "./plugins/bdk-skill-kit/src/index.ts";
import type { Config } from "./plugins/bdk-skill-kit/src/index.ts";

// Plugins whose descriptions were admitted by with/without evals (evals/RESULTS.md) trigger
// with "Load it when|before ..."; rewording them would void that measurement (design D5).
const LOAD_IT_TRIGGER = ["bdk-craft", "bdk-explain"];

const plugins = readdirSync(join(import.meta.dirname, "plugins"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const targets: Config["targets"] = plugins.flatMap((plugin) =>
  (["skills", "agents"] as const)
    .filter((kind) => existsSync(join(import.meta.dirname, "plugins", plugin, kind)))
    .map((kind) => ({
      kind,
      name: `${plugin}/${kind}`,
      dirs: [`plugins/${plugin}/${kind}`],
      ...(kind === "skills" && LOAD_IT_TRIGGER.includes(plugin)
        ? {
            rules: {
              "description-front-loaded": [
                "warning",
                { trigger: "\\b(Use (when|for|on|if|whenever)|Load it (when|before|whenever))\\b" },
              ],
            },
          }
        : {}),
    })),
);

export default defineConfig({ targets });
