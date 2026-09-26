// Content checks for BDK's own skills and agents (spec `skill-content-checks`).
// Every rule is the kit's; this file holds only BDK's settings.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "bdk-skill-kit";

// The `!` wrapper form and its `allowed-tools` pair come from the kernel-cli
// spec (Invocation), so they have one source. A layout change there fails the
// load (exit 2) instead of letting the check drift.
const KERNEL_CLI_SPEC = "openspec/specs/kernel-cli/spec.md";
const spec = readFileSync(join(import.meta.dirname, KERNEL_CLI_SPEC), "utf8");
const wrapper = /^```regex content-wrapper\n(.*)\n```$/m.exec(spec)?.[1];
const pair = /SHALL carry `allowed-tools: ([^`]+)`/.exec(spec)?.[1];
if (wrapper === undefined || pair === undefined) {
  throw new Error(
    `${KERNEL_CLI_SPEC}: no \`content-wrapper\` regex block or \`allowed-tools\` pair`,
  );
}

const LANGUAGE_MESSAGE =
  "names one stack's tooling; say what to run (\"the project's test suite\") and let the project settings name the command";

export default defineConfig({
  targets: [
    {
      kind: "skills",
      dirs: ["skills"],
      rules: {
        "block-form": ["error", { patterns: [wrapper] }],
        // Without the pair the host drops the whole skill in default permission mode.
        "block-allowed-tools": ["error", { require: pair.match(/\S+\([^)]*\)/g) ?? [] }],
        "required-fields": [
          "error",
          {
            entries: [
              {
                names: ["plan", "execute", "close", "run"],
                field: "disable-model-invocation",
                equals: true,
                reason: "a gate is started by the user only",
              },
              {
                names: ["execute", "close"],
                field: "disallowed-tools",
                includes: ["Edit", "Write", "NotebookEdit"],
                reason: "the gate delegates edits to workers",
              },
            ],
          },
        ],
      },
    },
    {
      kind: "agents",
      dirs: ["agents"],
      rules: {
        "block-form": ["error", { patterns: [wrapper] }],
        // Adapters are frontmatter plus one sentence.
        "body-shape": ["error", { maxLines: 1, maxSentences: 1, endsWith: "." }],
      },
    },
  ],
  rules: {
    "line-limit": ["error", { max: 200 }],
    // BDK's listing budget (.claude/rules/skills.md), below the host cap.
    description: ["error", { max: 250 }],
    "description-front-loaded": "error",
    "require-model": "error",
    layout: ["error", { allowed: ["references", "examples", "scripts", "assets"] }],
    "forbidden-text": [
      "error",
      {
        terms: [
          {
            words: ["mcp__plugin_bdk_"],
            match: "substring",
            message: "BDK ships no MCP server; call the kernel through `bdk` instead",
          },
          {
            words: [
              "pytest",
              "npm test",
              "yarn test",
              "cargo test",
              "cargo build",
              "rspec",
              "mvn",
              "gradle",
              "ruff",
              "eslint",
              "golangci-lint",
              "rubocop",
              "flake8",
            ],
            message: LANGUAGE_MESSAGE,
            // `setup` detects the stack, so it names what it maps.
            allow: ["setup"],
          },
          {
            // Plain English words too, so only inside code.
            words: ["go test", "jest", "mocha", "make"],
            where: "code",
            message: LANGUAGE_MESSAGE,
            allow: ["setup"],
          },
        ],
      },
    ],
    "namespaced-refs": ["error", { namespace: "bdk" }],
  },
  // v2 content the v3 tasks rewrite; each entry suppresses one known finding.
  baseline: "skill-check.baseline.json",
});
