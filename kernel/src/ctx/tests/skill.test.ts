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
  ...pack("engineering-judgment", "BDK-EJ-1", "**Trade-offs.** Named."),
  ...pack("plan", "BDK-PL-1", "**Done.** Checkable in review."),
  ...pack("plan", "BDK-PL-2", "**Small.** One concern per task."),
  ...pack("languages/typescript", "BDK-TS-1", "**Strict.** On.", "applies: ['**/*.ts']\n"),
  "fragments/decision/lavish.md": "**Decision tier: lavish**\n",
  "fragments/decision/ask-user.md": "**Decision tier: ask-user**\n",
  "skills/demo/references/engine.md": "# Engine\n\nSteps.\n",
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
      "Blocking categories (P8)",
      "Asking the user",
    ]);
    // The P8 section has its own tests below (verifier-policy part).
    const withoutPolicy = report.content.replace(
      /### Blocking categories \(P8\)\n[\s\S]*?(?=### Asking the user)/,
      "",
    );
    expect(withoutPolicy).toBe(
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
      { kind: "verifier-policy", source: "policy.verifier" },
      { kind: "fragment", source: "fragments/decision/ask-user" },
    ]);
  });

  it("refuses a name the manifest does not hold with input/not-found and a hint", () => {
    const outcome = composeSkill(input(), "setupp");
    expect(outcome).toMatchObject({
      refused: true,
      rule: "input/not-found",
      why: "setupp is not a skill with a BDK context",
      instead: ["bdk ctx skill setup", "check the skill name in the context lines"],
    });
  });

  it("refuses a bdk-* meta-skill, which the plugin no longer ships (T42-E)", () => {
    expect(composeSkill(input(), "bdk-rules-security")).toMatchObject({
      refused: true,
      rule: "input/not-found",
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
    expect(compose("plan").content).toContain(
      "### Rules: plan\n\n- [BDK-PL-1] **Done.** Checkable in review.\n- [BDK-PL-2] **Small.** One concern per task.\n",
    );
    const report = compose("plan", {
      ".bdk/settings.yaml": "rules:\n  disabled: [BDK-PL-2]\n",
    });
    const section = report.content.split("### Rules: plan\n\n")[1]?.split("\n### ")[0];
    expect(section).toBe("- [BDK-PL-1] **Done.** Checkable in review.\n");
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
    const report = compose("plan", { ".bdk/settings.yaml": "languages: [cobol]\n" });
    expect(titles(report.content).filter((title) => title.startsWith("Language"))).toStrictEqual(
      [],
    );
    expect(report.parts.map((part) => part.kind)).not.toContain("language-rules");
  });

  it("prints tool entries as config show does, including when, and none configured when empty", () => {
    const report = compose("setup", {
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
      { kind: "tools", source: "tools.build" },
    ]);
  });

  it("prints a plugin file verbatim under its manifest title", () => {
    const given = input();
    const resolved = resolveOrRefuse(given, { removed: "ignore" });
    if ("refused" in resolved) throw new Error(`refused: ${resolved.why}`);
    const part = {
      kind: "file",
      path: "skills/demo/references/engine.md",
      title: "Engine",
    } as const;
    expect(
      renderContext({ heading: "BDK context: demo", sections: sectionsOf(given, resolved, part) })
        .content,
    ).toContain("### Engine\n\n# Engine\n\nSteps.\n");
    expect(sectionsOf(given, resolved, part)[0]?.part).toStrictEqual({
      kind: "file",
      source: "skills/demo/references/engine.md",
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

describe("verifier-policy part (P8, T42)", () => {
  function sectionOf(name: string, project: Record<string, string> = {}): string {
    const content = compose(name, project).content;
    const start = content.indexOf("### Blocking categories (P8)\n");
    expect(start, `${name} has no verifier-policy section`).toBeGreaterThanOrEqual(0);
    const end = content.indexOf("\n### ", start + 1);
    return content.slice(start, end === -1 ? undefined : end).trimEnd();
  }

  it("prints the resolved categories, then the not-a-fail list, in the plan context", () => {
    const section = sectionOf("plan");
    const lines = section.split("\n");
    expect(lines.slice(0, 4)).toStrictEqual([
      "### Blocking categories (P8)",
      "",
      "- architecture: Materially invalid architecture, or a contradiction with an accepted decision.",
      "- security: A security, privacy or authentication risk.",
    ]);
    expect(section).toContain("- false-code-claim: A claim about the real code that is false.\n");
    expect(section).toContain("\n\n#### Not a fail\n\n- style: Style.\n");
    const notAFail = section.split("#### Not a fail\n\n")[1] ?? "";
    expect(notAFail.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(6);
  });

  it("is part of the design and cr contexts", () => {
    expect(sectionOf("design")).toBe(sectionOf("plan"));
    expect(sectionOf("cr")).toBe(sectionOf("plan"));
    expect(compose("design").parts).toContainEqual({
      kind: "verifier-policy",
      source: "policy.verifier",
    });
  });

  it("prints a category the project adds", () => {
    const section = sectionOf("plan", {
      ".bdk/settings.yaml":
        "policy:\n  verifier:\n    blocking-categories:\n      - id: data-retention\n        description: Personal data kept past its retention.\n",
    });
    expect(section).toContain("- data-retention: Personal data kept past its retention.\n");
    expect(section).toContain("- security: A security, privacy or authentication risk.\n");
  });
});
