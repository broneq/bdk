import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderContext } from "../render/sections.ts";
import { sectionsOf } from "../use-cases/parts.ts";
import { composeSkill } from "../use-cases/skill.ts";
import type { CtxInput } from "../use-cases/input.ts";
import { ruleFile } from "../../../tests/support/rule-file.ts";
import type { RuleFileFields } from "../../../tests/support/rule-file.ts";
import { fakeGit } from "../../log/tests/support.ts";
import type { RuleStage } from "../../shared/vocabulary/index.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";

function rule(id: string, text: string, fields: RuleFileFields = {}): string {
  return ruleFile(id, { origin: "bdk", text, ...fields });
}

/** The stages of each pack directory the fixture uses (`rule-pack`, Pack layout). */
const STAGES = {
  "code-quality": ["plan", "execute", "review"],
  architecture: ["design", "plan", "execute", "review"],
  "engineering-judgment": ["design", "plan"],
  plan: ["plan"],
  "languages/typescript": ["plan", "execute", "review"],
} satisfies Record<string, readonly RuleStage[]>;

function pack(
  dir: keyof typeof STAGES,
  id: string,
  text: string,
  fields: RuleFileFields = {},
): Record<string, string> {
  return { [`rules/${dir}/${id}.md`]: rule(id, text, { stages: STAGES[dir], ...fields }) };
}

const PLUGIN_FILES: Record<string, string> = {
  ...pack("code-quality", "BDK-CQ-1", "**Naming.** Plain."),
  ...pack("architecture", "BDK-ARCH-1", "**Layers.** Down only."),
  ...pack("engineering-judgment", "BDK-EJ-1", "**Trade-offs.** Named."),
  ...pack("plan", "BDK-PL-1", "**Done.** Checkable in review."),
  ...pack("plan", "BDK-PL-2", "**Small.** One concern per task."),
  ...pack("languages/typescript", "BDK-TS-1", "**Strict.** On.", { paths: ["**/*.ts"] }),
  "fragments/decision/lavish.md": "**Decision tier: lavish**\n",
  "fragments/decision/ask-user.md": "**Decision tier: ask-user**\n",
  "skills/demo/references/engine.md": "# Engine\n\nSteps.\n",
};

function input(
  project: Record<string, string> = {},
  installed: readonly string[] = [],
  workTree: readonly string[] = ["src/app.ts"],
): CtxInput {
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(PLUGIN_FILES)) files[`${PLUGIN}/${path}`] = text;
  for (const [path, text] of Object.entries(project)) files[`${PROJECT}/${path}`] = text;
  const git = fakeGit();
  git.workTree.push(...workTree);
  return {
    store: memoryStore(files),
    git,
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
    globalDir: "/home/dev/.config/bdk",
    projectRoot: PROJECT,
    which: (name) => (installed.includes(name) ? `/usr/bin/${name}` : undefined),
  };
}

async function compose(name: string, ...args: Parameters<typeof input>) {
  const outcome = await composeSkill(input(...args), name);
  if ("refused" in outcome) throw new Error(`refused: ${outcome.why}`);
  return renderContext(outcome);
}

/** The lines of the `### Rules` section. */
function rulesOf(report: { content: string }): string[] {
  const section = report.content.split("### Rules\n\n")[1]?.split("\n### ")[0] ?? "";
  return section.split("\n").filter((line) => line !== "");
}

function titles(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.startsWith("## ") || line.startsWith("### "))
    .map((line) => line.replace(/^#+ /, ""));
}

describe("ctx skill", () => {
  it("prints the heading and one section per part in manifest order", async () => {
    const report = await compose("design");
    expect(titles(report.content)).toStrictEqual([
      "BDK context: design",
      "Rules",
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
        "### Rules",
        "",
        "- [BDK-ARCH-1] **Layers.** Down only.",
        "- [BDK-EJ-1] **Trade-offs.** Named.",
        "",
        "### Asking the user",
        "",
        "**Decision tier: ask-user**",
        "",
      ].join("\n"),
    );
    expect(report.parts).toStrictEqual([
      { kind: "rules", source: "stage:design" },
      { kind: "verifier-policy", source: "policy.verifier" },
      { kind: "fragment", source: "fragments/decision/ask-user" },
    ]);
  });

  it("refuses a name the manifest does not hold with input/not-found and a hint", async () => {
    const outcome = await composeSkill(input(), "setupp");
    expect(outcome).toMatchObject({
      refused: true,
      rule: "input/not-found",
      why: "setupp is not a skill with a BDK context",
      instead: ["bdk ctx skill setup", "check the skill name in the context lines"],
    });
  });

  it("refuses a bdk-* meta-skill, which the plugin no longer ships (T42-E)", async () => {
    expect(await composeSkill(input(), "bdk-rules-security")).toMatchObject({
      refused: true,
      rule: "input/not-found",
    });
  });

  it("refuses an unknown key and an invalid value", async () => {
    expect(
      await composeSkill(input({ ".bdk/settings.yaml": "tools:\n  tests: []\n" }), "design"),
    ).toMatchObject({ rule: "policy/unknown-config-key" });
    expect(
      await composeSkill(input({ ".bdk/settings.yaml": "features:\n  lavish: maybe\n" }), "design"),
    ).toMatchObject({ rule: "policy/config-invalid" });
  });

  it("gives byte-identical output with and without a removed v2 key", async () => {
    const without = await compose("design", { ".bdk/settings.yaml": "languages: [typescript]\n" });
    const withKey = await compose("design", {
      ".bdk/settings.yaml": "languages: [typescript]\nfeatures:\n  code-review-graph: true\n",
    });
    expect(withKey).toStrictEqual(without);
  });

  describe("the decision fragment", () => {
    it("asks in the terminal with features.lavish false, even with lavish-axi installed", async () => {
      const report = await compose(
        "design",
        { ".bdk/settings.yaml": "features:\n  lavish: false\n" },
        ["lavish-axi"],
      );
      expect(report.content).toContain("Decision tier: ask-user");
      expect(report.content).not.toContain("Decision tier: lavish");
    });

    it("asks in the terminal when lavish-axi is not on PATH", async () => {
      expect((await compose("design")).content).toContain("Decision tier: ask-user");
    });

    it("routes through Lavish when switched on and installed", async () => {
      const report = await compose("design", {}, ["lavish-axi"]);
      expect(report.content).toContain("Decision tier: lavish");
      expect(report.parts.at(-1)).toStrictEqual({
        kind: "fragment",
        source: "fragments/decision/lavish",
      });
    });
  });

  it("prints the stage's rules in selection order, each with its id, and leaves a disabled one out", async () => {
    const plan = [
      "- [BDK-ARCH-1] **Layers.** Down only.",
      "- [BDK-CQ-1] **Naming.** Plain.",
      "- [BDK-EJ-1] **Trade-offs.** Named.",
      "- [BDK-PL-1] **Done.** Checkable in review.",
      "- [BDK-PL-2] **Small.** One concern per task.",
    ];
    expect(rulesOf(await compose("plan"))).toStrictEqual(plan);
    const report = await compose("plan", {
      ".bdk/settings.yaml": "rules:\n  disabled: [BDK-PL-2]\n",
    });
    expect(rulesOf(report)).toStrictEqual(plan.slice(0, 4));
  });

  it("adds a project rule to the stage's rules, its paths after a scoped one", async () => {
    const project = {
      ".bdk/rules/API-1.md": rule("API-1", "Handlers stay thin.", {
        paths: ["src/api/**"],
        origin: "user",
      }),
    };
    const report = await compose("design", project, [], ["src/api/x.ts"]);
    expect(rulesOf(report).at(-1)).toBe("- [API-1] Handlers stay thin. (paths: src/api/**)");
    expect(rulesOf(await compose("design", project, [], ["docs/a.md"]))).not.toContainEqual(
      expect.stringContaining("API-1"),
    );
  });

  it("leaves out a rule of another stage", async () => {
    const report = await compose("design", {
      ".bdk/rules/E2E-1.md": rule("E2E-1", "Seed through the API.", {
        origin: "user",
        stages: ["execute", "review"],
      }),
    });
    expect(rulesOf(report)).not.toContainEqual(expect.stringContaining("E2E-1"));
    expect(rulesOf(report)).toContain("- [BDK-ARCH-1] **Layers.** Down only.");
  });

  it("stops on a rule prompt file left from before rule ids", async () => {
    const outcome = await composeSkill(
      input({ ".bdk/prompts/rules/security.md": "- **Ours.** Too.\n" }),
      "design",
    );
    expect(outcome).toMatchObject({ rule: "policy/unknown-config-key" });
    expect("why" in outcome ? outcome.why : "").toMatch(/\.bdk\/rules\//);
  });

  it("adds the rules of a language in languages, and of no language without a pack", async () => {
    const report = await compose("plan", {
      ".bdk/settings.yaml": "languages: [typescript, cobol]\n",
    });
    expect(rulesOf(report)).toContain("- [BDK-TS-1] **Strict.** On. (paths: **/*.ts)");
    expect(report.content).not.toContain("cobol");
  });

  it("leaves out a language pack whose files the work tree does not hold", async () => {
    const report = await compose(
      "plan",
      { ".bdk/settings.yaml": "languages: [typescript]\n" },
      [],
      ["main.py"],
    );
    expect(rulesOf(report)).not.toContainEqual(expect.stringContaining("BDK-TS-1"));
  });

  it("omits the rules part when the stage selects nothing", async () => {
    const report = await compose("adr", {
      ".bdk/settings.yaml": "rules:\n  disabled: [BDK-ARCH-1, BDK-EJ-1]\n",
    });
    expect(titles(report.content)).not.toContain("Rules");
    expect(report.parts.map((part) => part.kind)).not.toContain("rules");
  });

  it("prints tool entries as config show does, including when, and each group's state", async () => {
    const report = await compose("setup", {
      ".bdk/settings.yaml": [
        "tools:",
        "  test:",
        "    - id: unit",
        "      tier: fast",
        "      command: pnpm test:unit",
        "      when: before every commit",
        "  lint: none",
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
        "declared none (tools.lint: none)",
        "",
        "### Project commands: build",
        "",
        "none configured",
        "",
      ].join("\n"),
    );
    expect(report.parts).toStrictEqual([
      { kind: "tools", source: "tools.test" },
      { kind: "tools", source: "tools.lint" },
      { kind: "tools", source: "tools.build" },
      { kind: "setup-coverage", source: "setup" },
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
      renderContext({
        heading: "BDK context: demo",
        sections: sectionsOf(given, resolved, part, []),
      }).content,
    ).toContain("### Engine\n\n# Engine\n\nSteps.\n");
    expect(sectionsOf(given, resolved, part, [])[0]?.part).toStrictEqual({
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
    return sectionsOf(given, resolved, { kind: "concurrency" }, []);
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
  async function sectionOf(name: string, project: Record<string, string> = {}): Promise<string> {
    const { content } = await compose(name, project);
    const start = content.indexOf("### Blocking categories (P8)\n");
    expect(start, `${name} has no verifier-policy section`).toBeGreaterThanOrEqual(0);
    const end = content.indexOf("\n### ", start + 1);
    return content.slice(start, end === -1 ? undefined : end).trimEnd();
  }

  it("prints the resolved categories, then the not-a-fail list, in the plan context", async () => {
    const section = await sectionOf("plan");
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

  it("is part of the design and cr contexts", async () => {
    expect(await sectionOf("design")).toBe(await sectionOf("plan"));
    expect(await sectionOf("cr")).toBe(await sectionOf("plan"));
    expect((await compose("design")).parts).toContainEqual({
      kind: "verifier-policy",
      source: "policy.verifier",
    });
  });

  it("prints a category the project adds", async () => {
    const section = await sectionOf("plan", {
      ".bdk/settings.yaml":
        "policy:\n  verifier:\n    blocking-categories:\n      - id: data-retention\n        description: Personal data kept past its retention.\n",
    });
    expect(section).toContain("- data-retention: Personal data kept past its retention.\n");
    expect(section).toContain("- security: A security, privacy or authentication risk.\n");
  });
});

describe("setup-coverage part (T56)", () => {
  function coverage(project: Record<string, string> = {}): string {
    const given = input(project);
    const resolved = resolveOrRefuse(given, { removed: "ignore" });
    if ("refused" in resolved) throw new Error(`refused: ${resolved.why}`);
    const sections = sectionsOf(given, resolved, { kind: "setup-coverage" }, []);
    expect(sections.map((section) => [section.title, section.part])).toStrictEqual([
      ["Setup coverage", { kind: "setup-coverage", source: "setup" }],
    ]);
    return sections[0]?.body ?? "";
  }

  function lines(body: string, heading: string): string[] {
    const [, after = ""] = body.split(`#### ${heading}\n\n`);
    return (after.split("\n\n")[0] ?? "").split("\n").filter((line) => line !== "");
  }

  it("follows the setup manifest entry after the tools parts", async () => {
    expect(titles((await compose("setup")).content)).toStrictEqual([
      "BDK context: setup",
      "Project commands: test",
      "Project commands: lint",
      "Project commands: build",
      "Setup coverage",
    ]);
  });

  it("groups every key by class with its default value on an empty project", () => {
    const body = coverage();
    expect(body.indexOf("#### Derived")).toBeLessThan(body.indexOf("#### Asked"));
    expect(body.indexOf("#### Asked")).toBeLessThan(body.indexOf("#### Not set by setup"));
    expect(lines(body, "Derived")).toContain("- tools.test: unset (default)");
    expect(lines(body, "Derived")).toContain("- languages: [] (default)");
    expect(lines(body, "Derived")).toContain("- spec.normative-word: SHALL (default)");
    expect(lines(body, "Asked")).toStrictEqual([
      "- policy.gates.design: manual (default)",
      "- policy.gates.review: manual (default)",
      "- review.risks: auth, migration, secrets, public-api, dependencies, configuration (default)",
      "- tracker: unset (default)",
    ]);
    const rest = lines(body, "Not set by setup");
    expect(rest).toContain("- policy.budgets.part: 3 (default)");
    expect(rest).toContain("- prompts.files.<key>: 0 (default)");
    expect(rest).toContain("- prompts.dir: unset (default)");
    const all = [...lines(body, "Derived"), ...lines(body, "Asked"), ...rest];
    expect(all).toHaveLength(settingsRegistry().setupKeys().length);
  });

  it("names the layer a value comes from, an id array by its highest layer", () => {
    const body = coverage({
      ".bdk/settings.yaml":
        "policy:\n  gates:\n    review: auto\nreview:\n  risks:\n    - { id: secrets, enabled: false }\ntools:\n  lint: none\n  test:\n    - { id: unit, tier: fast, command: npx vitest run }\n",
      ".bdk/settings.local.yaml": "diagnostics:\n  verbose: true\n",
    });
    expect(lines(body, "Asked")).toContain("- policy.gates.review: auto (project)");
    expect(lines(body, "Asked")).toContain(
      "- review.risks: auth, migration, secrets, public-api, dependencies, configuration (project)",
    );
    expect(lines(body, "Derived")).toContain("- tools.test: unit (project)");
    expect(lines(body, "Derived")).toContain("- tools.lint: none (project)");
    expect(lines(body, "Not set by setup")).toContain("- diagnostics.verbose: true (local)");
  });

  it("joins the items of a plain array", () => {
    const body = coverage({ ".bdk/settings.yaml": "languages: [typescript, react]\n" });
    expect(lines(body, "Derived")).toContain("- languages: typescript, react (project)");
  });
});
