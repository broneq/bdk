import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderContext } from "../render/sections.ts";
import { composeSkill } from "../use-cases/skill.ts";
import type { CtxInput } from "../use-cases/input.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";

const PLUGIN_FILES: Record<string, string> = {
  "rules/code-quality.md": "# Code Quality Rules\n\n- **Naming.** Plain.\n",
  "rules/architecture.md": "# Architecture Rules\n\n- **Layers.** Down only.\n",
  "rules/design-patterns.md": "# Design Patterns\n",
  "rules/security.md": "# Security Rules\n\n- **Secrets.** Never logged.\n",
  "rules/engineering-judgment.md": "# Engineering Judgment\n",
  "rules/test-quality.md": "# Test Quality\n",
  "rules/languages/typescript.md": "# TypeScript\n\n- **Strict.** On.\n",
  "fragments/decision/lavish.md": "**Decision tier: lavish**\n",
  "fragments/decision/ask-user.md": "**Decision tier: ask-user**\n",
  "skills/cr/references/review-engine.md": "# Review engine\n\nSteps.\n",
  "skills/cr/references/report-format.md": "# Report format\n",
};

function input(project: Record<string, string> = {}, installed: readonly string[] = []): CtxInput {
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(PLUGIN_FILES)) files[`${PLUGIN}/${path}`] = text;
  for (const [path, text] of Object.entries(project)) files[`${PROJECT}/${path}`] = text;
  return {
    store: memoryStore(files),
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
    globalDir: "/home/dev/.config/bdk",
    projectRoot: PROJECT,
    which: (name) => (installed.includes(name) ? `/usr/bin/${name}` : undefined),
  };
}

function compose(name: string, ...args: Parameters<typeof input>) {
  const outcome = composeSkill(input(...args), name);
  if ("refused" in outcome) throw new Error(`refused: ${outcome.why}`);
  return renderContext(outcome);
}

function titles(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.startsWith("## ") || line.startsWith("### "))
    .map((line) => line.replace(/^#+ /, ""));
}

describe("ctx skill", () => {
  it("prints the heading and one section per part in manifest order", () => {
    const report = compose("design");
    expect(titles(report.content)).toStrictEqual([
      "BDK context: design",
      "Rules: architecture",
      "Rules: engineering-judgment",
      "Asking the user",
    ]);
    expect(report.content).toBe(
      [
        "## BDK context: design",
        "",
        "### Rules: architecture",
        "",
        "# Architecture Rules",
        "",
        "- **Layers.** Down only.",
        "",
        "### Rules: engineering-judgment",
        "",
        "# Engineering Judgment",
        "",
        "### Asking the user",
        "",
        "**Decision tier: ask-user**",
        "",
      ].join("\n"),
    );
    expect(report.parts).toStrictEqual([
      { kind: "rules", source: "rules/architecture" },
      { kind: "rules", source: "rules/engineering-judgment" },
      { kind: "fragment", source: "fragments/decision/ask-user" },
    ]);
  });

  it("refuses a name the manifest does not hold with input/not-found and a hint", () => {
    const outcome = composeSkill(input(), "debugg");
    expect(outcome).toMatchObject({
      refused: true,
      rule: "input/not-found",
      why: "debugg is not a skill with a BDK context",
      instead: ["bdk ctx skill debug", "check the skill name in the context lines"],
    });
  });

  it("refuses an unknown key and an invalid value", () => {
    expect(
      composeSkill(input({ ".bdk/settings.yaml": "tools:\n  tests: []\n" }), "design"),
    ).toMatchObject({ rule: "policy/unknown-config-key" });
    expect(
      composeSkill(input({ ".bdk/settings.yaml": "features:\n  lavish: maybe\n" }), "design"),
    ).toMatchObject({ rule: "policy/config-invalid" });
  });

  it("gives byte-identical output with and without a removed v2 key", () => {
    const without = compose("design", { ".bdk/settings.yaml": "languages: [typescript]\n" });
    const withKey = compose("design", {
      ".bdk/settings.yaml": "languages: [typescript]\nfeatures:\n  code-review-graph: true\n",
    });
    expect(withKey).toStrictEqual(without);
  });

  describe("the decision fragment", () => {
    it("asks in the terminal with features.lavish false, even with lavish-axi installed", () => {
      const report = compose("design", { ".bdk/settings.yaml": "features:\n  lavish: false\n" }, [
        "lavish-axi",
      ]);
      expect(report.content).toContain("Decision tier: ask-user");
      expect(report.content).not.toContain("Decision tier: lavish");
    });

    it("asks in the terminal when lavish-axi is not on PATH", () => {
      expect(compose("design").content).toContain("Decision tier: ask-user");
    });

    it("routes through Lavish when switched on and installed", () => {
      const report = compose("design", {}, ["lavish-axi"]);
      expect(report.content).toContain("Decision tier: lavish");
      expect(report.parts.at(-1)).toStrictEqual({
        kind: "fragment",
        source: "fragments/decision/lavish",
      });
    });
  });

  it("appends a project file with mode extends to the plugin rule set", () => {
    const report = compose("create-plan", {
      ".bdk/prompts/rules/security.md": "---\nmode: extends\n---\n- **Ours.** Too.\n",
    });
    const section = report.content.split("### Rules: security\n\n")[1]?.split("\n### ")[0];
    expect(section).toBe("# Security Rules\n\n- **Secrets.** Never logged.\n\n- **Ours.** Too.\n");
  });

  it("puts a project file with mode replace in place of the plugin rule set", () => {
    const report = compose("create-plan", {
      ".bdk/prompts/rules/security.md": "---\nmode: replace\n---\n- **Ours.** Only.\n",
    });
    const section = report.content.split("### Rules: security\n\n")[1]?.split("\n### ")[0];
    expect(section).toBe("- **Ours.** Only.\n");
  });

  it("prints the language rules of every language with a value, in order", () => {
    const report = compose("create-plan", {
      ".bdk/settings.yaml": "languages: [typescript, cobol]\n",
    });
    expect(titles(report.content).filter((title) => title.startsWith("Language"))).toStrictEqual([
      "Language rules: typescript",
    ]);
    expect(report.parts).toContainEqual({
      kind: "language-rules",
      source: "rules/languages/typescript",
    });
  });

  it("omits the language rules part when no language has a value", () => {
    const report = compose("bdk-rules-languages", { ".bdk/settings.yaml": "languages: [cobol]\n" });
    expect(report.content).toBe("## BDK context: bdk-rules-languages\n");
    expect(report.parts).toStrictEqual([]);
  });

  it("prints tool entries as config show does, including when, and none configured when empty", () => {
    const report = compose("debug", {
      ".bdk/settings.yaml": [
        "tools:",
        "  test:",
        "    - id: unit",
        "      tier: fast",
        "      command: pnpm test:unit",
        "      when: before every commit",
      ].join("\n"),
    });
    expect(report.content).toContain(
      [
        "### Project commands: test",
        "",
        "- id: unit",
        "  command: pnpm test:unit",
        "  when: before every commit",
        "  tier: fast",
        "",
        "### Project commands: lint",
        "",
        "none configured",
        "",
      ].join("\n"),
    );
    expect(report.parts).toStrictEqual([
      { kind: "tools", source: "tools.test" },
      { kind: "tools", source: "tools.lint" },
    ]);
  });

  it("prints a plugin file verbatim under its manifest title", () => {
    const report = compose("cr");
    expect(report.content).toContain("### Review engine\n\n# Review engine\n\nSteps.\n");
    expect(report.parts[0]).toStrictEqual({
      kind: "file",
      source: "skills/cr/references/review-engine.md",
    });
  });
});
