// Every generic rule at error, so each seeded violation exits 1. The policy
// rules need options, so each gets values the clean tree satisfies.
export default {
  targets: [
    { kind: "skills", dirs: ["skills"] },
    {
      kind: "agents",
      dirs: ["agents"],
      rules: { "body-shape": ["error", { maxLines: 1, maxSentences: 1, endsWith: "." }] },
    },
    { kind: "skills", dirs: ["craft"], profile: "portable" },
  ],
  rules: {
    "description-front-loaded": "error",
    "require-model": "error",
    layout: ["error", { allowed: ["references", "scripts", "assets", "examples"] }],
    "block-form": ["error", { patterns: ["!`tool ctx [a-z-]+`"] }],
    "block-allowed-tools": ["error", { require: ["Bash(tool ctx *)"] }],
    "forbidden-text": [
      "error",
      {
        terms: [
          {
            words: ["mcp__plugin_kit_"],
            match: "substring",
            message: "the kit ships no MCP server; run the tool instead",
          },
        ],
      },
    ],
    "required-fields": [
      "error",
      {
        entries: [
          { names: ["fronted"], field: "metadata", equals: { "fronts-cli": "tool" } },
          { names: ["fronted"], field: "allowed-tools", includes: ["Bash(tool *)"] },
        ],
      },
    ],
    "namespaced-refs": ["error", { namespace: "kit" }],
  },
};
