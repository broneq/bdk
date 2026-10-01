import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderContext } from "../render/sections.ts";
import { sectionsOf } from "../use-cases/parts.ts";
import { composeSkill } from "../use-cases/skill.ts";
import type { CtxInput } from "../use-cases/input.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";

function rule(id: string, text: string, extra = "", origin = "bdk"): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: ${origin}\nsince: 2026-09-30\n${extra}---\n\n${text}\n`;
}

function pack(dir: string, id: string, text: string, extra = ""): Record<string, string> {
  return { [`rules/${dir}/${id}.md`]: rule(id, text, extra) };
}

const PLUGIN_FILES: Record<string, string> = {
  ...pack("code-quality", "BDK-CQ-1", "**Naming.** Plain."),
  ...pack("architecture", "BDK-ARCH-1", "**Layers.** Down only."),
  ...pack("security", "BDK-SEC-1", "**Secrets.** Never logged."),
  ...pack("security", "BDK-SEC-2", "**Tokens.** Short-lived."),
  ...pack("engineering-judgment", "BDK-EJ-1", "**Trade-offs.** Named."),
  ...pack("plan", "BDK-PL-1", "**Done.** Checkable in review."),
  ...pack("languages/typescript", "BDK-TS-1", "**Strict.** On.", "applies: ['**/*.ts']\n"),
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
        "- [BDK-ARCH-1] **Layers.** Down only.",
        "",
        "### Rules: engineering-judgment",
        "",
        "- [BDK-EJ-1] **Trade-offs.** Named.",
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

  it("prints each pack rule with its id, and leaves a disabled one out", () => {
    const report = compose("bdk-rules-security", {
      ".bdk/settings.yaml": "rules:\n  disabled: [BDK-SEC-2]\n",
    });
    const section = report.content.split("### Rules: security\n\n")[1]?.split("\n### ")[0];
    expect(section).toBe("- [BDK-SEC-1] **Secrets.** Never logged.\n");
    expect(compose("plan").content).toContain(
      "### Rules: plan\n\n- [BDK-PL-1] **Done.** Checkable in review.\n",
    );
  });

  it("prints the project's rules under their own title, with applies", () => {
    const report = compose("design", {
      ".bdk/rules/API-1.md": rule(
        "API-1",
        "Handlers stay thin.",
        "applies: [src/api/**]\n",
        "user",
      ),
    });
    expect(titles(report.content)).toContain("Project rules");
    expect(report.content).toContain("- [API-1] Handlers stay thin. (applies: src/api/**)\n");
    expect(report.parts).toContainEqual({ kind: "project-rules", source: ".bdk/rules" });
  });

  it("omits the project rules part when the project has none", () => {
    expect(titles(compose("design").content)).not.toContain("Project rules");
  });

  it("stops on a rule prompt file left from before rule ids", () => {
    const outcome = composeSkill(
      input({ ".bdk/prompts/rules/security.md": "- **Ours.** Too.\n" }),
      "design",
    );
    expect(outcome).toMatchObject({ rule: "policy/unknown-config-key" });
    expect("why" in outcome ? outcome.why : "").toMatch(/\.bdk\/rules\//);
  });

  it("prints the language rules of every language with a pack, in order", () => {
    const report = compose("plan", {
      ".bdk/settings.yaml": "languages: [typescript, cobol]\n",
    });
    expect(titles(report.content).filter((title) => title.startsWith("Language"))).toStrictEqual([
      "Language rules: typescript",
    ]);
    expect(report.content).toContain("- [BDK-TS-1] **Strict.** On. (applies: **/*.ts)\n");
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

describe("concurrency part", () => {
  function concurrency(project: Record<string, string> = {}) {
    const given = input(project);
    const resolved = resolveOrRefuse(given, { removed: "ignore" });
    if ("refused" in resolved) throw new Error(`refused: ${resolved.why}`);
    return sectionsOf(given, resolved, { kind: "concurrency" });
  }

  it("states the default of execution.concurrency", () => {
    expect(concurrency()).toStrictEqual([
      {
        title: "Concurrency",
        body: "Run at most 5 agents at once.\n",
        part: { kind: "concurrency", source: "execution.concurrency" },
      },
    ]);
  });

  it("states the value a project sets", () => {
    const [section] = concurrency({ ".bdk/settings.yaml": "execution:\n  concurrency: 3\n" });
    expect(section?.body).toBe("Run at most 3 agents at once.\n");
  });
});
