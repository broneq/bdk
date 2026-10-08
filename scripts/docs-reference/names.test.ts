import { describe, expect, it } from "vitest";

import type { Group } from "../../plugins/bdk/src/shared/cli/index.ts";
import type { Model } from "./model.ts";
import { checkNames } from "./names.ts";
import { renderReference } from "./render.ts";

// Hand-written pages name only what exists (spec `docs-site`), on a fixture model.

const run = () => ({ data: null, text: "" });

const CONFIG: Group = {
  name: "config",
  summary: "Configuration",
  commands: [
    { verb: "show", summary: "Show", run },
    { verb: "set", summary: "Set", run },
  ],
};

const MODEL: Model = {
  plugins: [
    {
      name: "bdk",
      description: "BDK.",
      skills: [
        { name: "plan", description: "Plans.", invocation: "user-and-model" },
        { name: "review-round", description: "A round.", invocation: "internal" },
      ],
      agents: [{ name: "verifier", description: "Verifies." }],
      hooks: [],
    },
  ],
  rules: [
    {
      id: "BDK-CQ-1",
      origin: "bdk",
      language: null,
      file: "rules/code-quality/BDK-CQ-1.md",
      kind: "house",
      paths: ["**"],
      stages: ["review"],
      source: null,
      verified: null,
      measured: null,
      text: "**Naming.** Text.",
    },
  ],
  cli: [CONFIG],
  settings: [
    { key: "policy", type: "mapping", required: false, description: "Policy." },
    { key: "policy.budgets", type: "mapping", required: false, description: "Budgets." },
    {
      key: "policy.budgets.review-rounds",
      type: "integer",
      required: false,
      description: "Rounds.",
    },
    { key: "tools", type: "mapping", required: false, description: "Tools." },
    { key: "tools.test", type: "items", required: false, description: "Tests." },
    { key: "tools.test.<id>.scoped", type: "string", required: false, description: "Scoped." },
    { key: "hooks", type: "mapping", required: false, description: "Hooks." },
  ],
};

function check(page: string): string[] {
  return checkNames(MODEL, renderReference(MODEL), new Map([["docs/concepts/x.md", page]]));
}

describe("checkNames", () => {
  it("passes names that exist", () => {
    expect(
      check(
        [
          "Run `/bdk:plan`, then `/bdk:review-round` on `bdk:verifier`.",
          "`bdk config show` and `bdk config set <key> <value>`; `bdk config --help`.",
          "Set `policy.budgets.review-rounds`, `policy.budgets.*`, `tools.test.unit.scoped`.",
          "Read `hooks/hooks.json`, see [plan](/reference/bdk/skills#plan) and [it](../reference/bdk/agents.md#verifier).",
          "`/bdk:<stage>` is a placeholder, and so is `bdk <group> <verb>`.",
          "Switch off `BDK-CQ-1` with `rules.disabled`; `BDK-<AREA>-<N>` is a pattern.",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("names a skill, agent, command, key and anchor that do not exist, with the line", () => {
    expect(
      check(
        [
          "# Page",
          "Run `/bdk:no-such-skill` on bdk:nobody.",
          "Then `bdk config nope` and `bdk nogroup show`.",
          "Set policy.budgets.nope.",
          "See [gone](/reference/bdk/skills#gone).",
          "Disable BDK-CQ-99.",
        ].join("\n"),
      ),
    ).toEqual([
      "docs/concepts/x.md:2: no skill /bdk:no-such-skill",
      "docs/concepts/x.md:2: no agent or skill bdk:nobody",
      "docs/concepts/x.md:3: no command bdk config nope",
      "docs/concepts/x.md:3: no command group bdk nogroup",
      "docs/concepts/x.md:4: no settings key policy.budgets.nope",
      "docs/concepts/x.md:5: no anchor #gone on /reference/bdk/skills",
      "docs/concepts/x.md:6: no rule BDK-CQ-99",
    ]);
  });

  it("reads Mermaid blocks too", () => {
    expect(
      check(
        [
          "```mermaid",
          "flowchart TB",
          '  A["/bdk:gone-round"] --> B["bdk config put"]',
          "```",
        ].join("\n"),
      ),
    ).toEqual([
      "docs/concepts/x.md:3: no skill /bdk:gone-round",
      "docs/concepts/x.md:3: no command bdk config put",
    ]);
  });

  it("does not read commands in plain prose, where bdk is a word", () => {
    expect(check("The bdk plugin and the bdk CLI.")).toEqual([]);
  });
});
