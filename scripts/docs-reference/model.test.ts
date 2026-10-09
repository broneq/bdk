import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Group } from "../../plugins/bdk/src/shared/cli/index.ts";
import { CHECKS } from "../../plugins/bdk/src/plan/domain/check.ts";
import { bdkGroups, loadModel, readPlugins, readRules } from "./model.ts";
import { renderReference } from "./render.ts";

// The source model of the Reference (design D3 of v3-268-docs-site-user-docs) on fixture plugins.

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "docs-reference-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(path: string, content: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function manifest(name: string, description = `The ${name} plugin.`): void {
  write(`${name}/.claude-plugin/plugin.json`, JSON.stringify({ name, description }));
}

function skill(plugin: string, name: string, front: string): void {
  write(`${plugin}/skills/${name}/SKILL.md`, `---\nname: ${name}\n${front}---\n\n# Body\n`);
}

const HOOKS: Group = {
  name: "hooks",
  summary: "Hook commands",
  commands: [
    {
      verb: "session-start",
      summary: "Print the session context",
      run: () => ({ data: null, text: "" }),
    },
  ],
};

describe("readPlugins", () => {
  it("reads skills with their invocation, arguments and description", () => {
    manifest("kit");
    skill("kit", "plan", 'description: "Plans <a> Change."\nargument-hint: "[change-name]"\n');
    skill("kit", "round", 'description: "One round."\nuser-invocable: false\n');
    skill("kit", "use", 'description: "Switch."\ndisable-model-invocation: true\n');
    const [kit] = readPlugins(root, []);
    expect(kit?.name).toBe("kit");
    expect(kit?.skills).toEqual([
      {
        name: "plan",
        description: "Plans <a> Change.",
        argumentHint: "[change-name]",
        invocation: "user-and-model",
      },
      { name: "round", description: "One round.", invocation: "internal" },
      { name: "use", description: "Switch.", invocation: "user-only" },
    ]);
  });

  it("reads agents with model and tools", () => {
    manifest("kit");
    write(
      "kit/agents/judge.md",
      "---\nname: judge\ndescription: Judges.\nmodel: sonnet\ntools: Read, Grep\n---\nBody\n",
    );
    expect(readPlugins(root, [])[0]?.agents).toEqual([
      { name: "judge", description: "Judges.", model: "sonnet", tools: ["Read", "Grep"] },
    ]);
  });

  it("fails naming a hook whose description has no source", () => {
    manifest("kit");
    write(
      "kit/hooks/hooks.json",
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node x.mjs" }] }],
        },
      }),
    );
    expect(() => readPlugins(root, [HOOKS])).toThrow(/kit\/hooks\/hooks.json.*PreToolUse/);
  });

  it("orders hooks by event and reads their descriptions", () => {
    manifest("kit");
    write(
      "kit/hooks/hooks.json",
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start -',
                  timeout: 10,
                },
                { type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/start.mjs"' },
              ],
            },
          ],
        },
      }),
    );
    write("kit/hooks/start.mjs", "#!/usr/bin/env node\n/**\n * Reports the profile. More.\n */\n");
    expect(readPlugins(root, [HOOKS])[0]?.hooks).toEqual([
      {
        event: "SessionStart",
        command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start -',
        timeout: 10,
        description: "Print the session context.",
      },
      {
        event: "SessionStart",
        command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/start.mjs"',
        description: "Reports the profile.",
      },
    ]);
  });

  it("fails naming a skill without a description", () => {
    manifest("kit");
    skill("kit", "plan", "");
    expect(() => readPlugins(root, [])).toThrow(/kit\/skills\/plan\/SKILL.md.*description/);
  });

  it("fails naming a plugin without a description", () => {
    write("kit/.claude-plugin/plugin.json", JSON.stringify({ name: "kit" }));
    expect(() => readPlugins(root, [])).toThrow(/kit\/.claude-plugin\/plugin.json.*description/);
  });
});

function rule(path: string, front: string, text = "**Rule.** Text."): void {
  write(path, `---\n${front}---\n\n${text}\n`);
}

describe("readRules", () => {
  it("reads every rule with its language pack, in number order of the ids", () => {
    rule("rules/code-quality/BDK-CQ-10.md", 'kind: house\npaths: ["**"]\nstages: [review]\n');
    rule("rules/code-quality/BDK-CQ-2.md", 'kind: house\npaths: ["**"]\nstages: [execute]\n');
    rule(
      "rules/languages/react/BDK-REACT-1.md",
      'kind: house\npaths: ["**/*.tsx"]\nstages: [review]\n',
    );
    write("rules/README.md", "# Not a rule\n");
    const rules = readRules(join(root, "rules"));
    expect(rules.map((found) => [found.id, found.language])).toEqual([
      ["BDK-CQ-2", null],
      ["BDK-CQ-10", null],
      ["BDK-REACT-1", "react"],
    ]);
    expect(rules[0]?.text).toBe("**Rule.** Text.");
  });

  it("fails naming a rule file the pack parser rejects", () => {
    rule("rules/BDK-X-1.md", "kind: house\npaths: []\nstages: [review]\n");
    expect(() => readRules(join(root, "rules"))).toThrow(/BDK-X-1\.md/);
  });
});

describe("bdkGroups", () => {
  it("builds every slice's group, sorted as bdk --help lists them", async () => {
    const names = (await bdkGroups()).map((group) => group.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const src = join(import.meta.dirname, "../../plugins/bdk/src");
    const slices = readdirSync(src, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "shared")
      .map((entry) => entry.name)
      .sort();
    expect(names).toEqual(slices);
  });
});

describe("renderReference", () => {
  it("is deterministic and marks every page as generated", () => {
    manifest("kit");
    skill("kit", "plan", 'description: "Plans {{ x }} <b>."\n');
    const model = {
      plugins: readPlugins(root, []),
      rules: [],
      cli: [HOOKS],
      settings: [],
      planProblems: [],
    };
    const first = renderReference(model);
    expect(renderReference(model)).toEqual(first);
    for (const [path, page] of first) {
      expect(page.startsWith("<!-- Generated by `pnpm docs:reference`"), path).toBe(true);
    }
    const page = first.get("kit.md") ?? "";
    expect(page).toContain("## `/kit:plan` {#plan}");
    expect(page).toContain("Plans {{ x }} &lt;b&gt;.");
    expect(page).toContain("::: v-pre");
  });

  it("shows each section whole: its example over every default, a comment per key", () => {
    manifest("bdk");
    const settings = [
      {
        key: "policy",
        type: "mapping" as const,
        required: false,
        description: "How autonomous a run is.",
        examples: [{ questions: "decide-and-record" }],
      },
      {
        key: "policy.questions",
        type: "enum" as const,
        values: ["decide-and-record", "stop"],
        default: "stop",
        required: false,
        description: "What a skill does with an open question; more text.",
      },
      {
        key: "policy.budgets",
        type: "mapping" as const,
        required: false,
        description: "Limits on retries.",
      },
      {
        key: "policy.budgets.verifier",
        type: "integer" as const,
        default: 3,
        required: false,
        description: "Most verifier passes.",
      },
      {
        key: "models",
        type: "map" as const,
        default: {},
        required: false,
        description: "Model per role.",
        examples: [{ implementer: "opus", reviewer: "sonnet" }],
      },
      { key: "models.<role>", type: "string" as const, required: true, description: "Model name." },
    ];
    const page =
      renderReference({
        plugins: readPlugins(root, []),
        rules: [],
        cli: [],
        settings,
        planProblems: [],
      }).get("bdk/settings.md") ?? "";
    expect(page).toContain(
      "```yaml\npolicy:\n  # What a skill does with an open question (decide-and-record | stop, default: stop)\n  questions: decide-and-record\n  # Limits on retries\n  budgets:\n    # Most verifier passes\n    verifier: 3\n```",
    );
    expect(page).toContain(
      "```yaml\nmodels:\n  # Model name\n  implementer: opus\n  reviewer: sonnet\n```",
    );
    expect(page.match(/```yaml/g)).toHaveLength(2);
  });

  it("catalogues the rule pack on the bdk plugin's rules page", () => {
    manifest("bdk");
    rule(
      "rules/code-quality/BDK-CQ-1.md",
      'kind: house\npaths: ["**"]\nstages: [execute, review]\n',
      "**Naming.** Descriptive <identifiers>.",
    );
    rule(
      "rules/languages/react/BDK-REACT-2.md",
      'kind: house\npaths: ["**/*.tsx"]\nstages: [review]\n',
    );
    const model = {
      plugins: readPlugins(root, []),
      rules: readRules(join(root, "rules")),
      cli: [],
      settings: [],
      planProblems: [],
    };
    const page = renderReference(model).get("bdk/rules.md") ?? "";
    expect(page).toContain("| [`BDK-CQ-1`](#bdk-cq-1) | Naming |");
    expect(page).toContain("### `BDK-REACT-2` {#bdk-react-2}");
    expect(page).toContain("Language pack: `react`");
    expect(page).toContain("Descriptive &lt;identifiers&gt;.");
  });

  it("lists the problems of bdk plan check under its CLI entry, one row per kind", async () => {
    const page = renderReference(await loadModel()).get("bdk/cli.md") ?? "";
    const entry = page.indexOf("### `bdk plan check` {#plan-check}");
    const section = page.indexOf("#### Problems {#plan-check-problems}");
    expect(entry).toBeGreaterThan(-1);
    expect(section).toBeGreaterThan(entry);
    const rows = page
      .slice(section, page.indexOf("\n## ", section))
      .split("\n")
      .flatMap((line) => /^\| `([a-z-]+)` \|/.exec(line)?.[1] ?? []);
    expect(rows, "Every check of bdk plan check needs its row in the CLI Reference").toEqual([
      ...CHECKS,
    ]);
  });
});
