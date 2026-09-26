import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { startupContext as renderStartup } from "../index.ts";

const PLUGIN = "/plugin";

const STARTUP = [
  "# BDK Shared Foundation",
  "",
  "## Agents",
  "",
  "<!-- bdk:agents-table -->",
  "",
  "| stale | table |",
  "",
  "<!-- /bdk:agents-table -->",
  "",
  "## After",
  "",
].join("\n");

function agent(name: string, model: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\nmodel: ${model}\n---\n\nBody.\n`;
}

function deps(files: Record<string, string>) {
  const store: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) store[`${PLUGIN}/${path}`] = text;
  return { store: memoryStore(store), pluginRoot: PLUGIN, settings: settingsRegistry() };
}

describe("ctx startup", () => {
  it("replaces the lines between the markers with one table sorted by name", () => {
    const report = renderStartup(
      deps({
        "STARTUP_INSTRUCTIONS.md": STARTUP,
        "agents/test-runner.md": agent("test-runner", "haiku", "Run tests | report"),
        "agents/explorer.md": agent("explorer", "haiku", "Fast read-only exploration"),
        "agents/architecture-reviewer.md": agent("architecture-reviewer", "opus", "Cross-cutting"),
        "agents/README.txt": "not an agent",
      }),
    );
    expect(report.content).toBe(
      [
        "# BDK Shared Foundation",
        "",
        "## Agents",
        "",
        "<!-- bdk:agents-table -->",
        "",
        "| `subagent_type`             | Model | When to pick               |",
        "| --------------------------- | ----- | -------------------------- |",
        "| `bdk:architecture-reviewer` | opus  | Cross-cutting              |",
        "| `bdk:explorer`              | haiku | Fast read-only exploration |",
        "| `bdk:test-runner`           | haiku | Run tests \\| report        |",
        "",
        "<!-- /bdk:agents-table -->",
        "",
        "## After",
        "",
      ].join("\n"),
    );
    expect(report.parts).toStrictEqual([
      { kind: "startup", source: "STARTUP_INSTRUCTIONS.md" },
      { kind: "agents-table", source: "agents/" },
    ]);
  });

  it("is idempotent: its output rendered again is unchanged", () => {
    const files = {
      "agents/explorer.md": agent("explorer", "haiku", "Fast"),
    };
    const once = renderStartup(deps({ ...files, "STARTUP_INSTRUCTIONS.md": STARTUP })).content;
    expect(renderStartup(deps({ ...files, "STARTUP_INSTRUCTIONS.md": once })).content).toBe(once);
  });

  it("throws on a file without the markers and on an agent without a model", () => {
    expect(() => renderStartup(deps({ "STARTUP_INSTRUCTIONS.md": "# No markers\n" }))).toThrow(
      /agents-table/,
    );
    expect(() =>
      renderStartup(
        deps({
          "STARTUP_INSTRUCTIONS.md": STARTUP,
          "agents/broken.md": "---\nname: broken\ndescription: No model\n---\n",
        }),
      ),
    ).toThrow(/agents\/broken\.md/);
  });
});
