import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { demoteHeadings } from "../domain/markdown.ts";
import { craftContext, installedCraft } from "../index.ts";

const PLUGIN = "/plugin";
const HOME = "/home/dev";
const CACHE = `${HOME}/.claude/plugins/cache`;

function skill(name: string, body: string): string {
  return `---\nname: ${name}\ndescription: The ${name} skill. Use when testing.\n---\n\n${body}`;
}

function contentOf(outcome: ReturnType<typeof craftContext>): string {
  if ("refused" in outcome) throw new Error(outcome.why);
  return outcome.content;
}

function input(files: Record<string, string>) {
  return { store: memoryStore(files), pluginRoot: PLUGIN, home: HOME };
}

describe("demoteHeadings", () => {
  it("adds one level to every heading outside a fenced block", () => {
    expect(demoteHeadings("# A\n## B\n```md\n# not a heading\n```\nText #1")).toBe(
      "## A\n### B\n```md\n# not a heading\n```\nText #1",
    );
  });

  it("adds several levels and stops at six", () => {
    expect(demoteHeadings("# A\n##### E", 3)).toBe("#### A\n###### E");
  });
});

describe("ctx craft lookup", () => {
  it("prefers the checkout of the running plugin over the cache", () => {
    const outcome = craftContext(
      input({
        [`${PLUGIN}/plugins/bdk-craft/skills/tdd/SKILL.md`]: skill("tdd", "# Checkout\n"),
        [`${CACHE}/bdk/bdk-craft/9.9.9/skills/tdd/SKILL.md`]: skill("tdd", "# Cached\n"),
      }),
      "tdd",
    );
    expect(contentOf(outcome)).toContain("## Checkout");
  });

  it("takes the highest cached version by semantic version, across marketplaces", () => {
    const outcome = craftContext(
      input({
        [`${CACHE}/bdk/bdk-craft/0.2.0/skills/tdd/SKILL.md`]: skill("tdd", "# Old\n"),
        [`${CACHE}/mirror/bdk-craft/0.10.0/skills/tdd/SKILL.md`]: skill("tdd", "# New\n"),
        [`${CACHE}/bdk/bdk-craft/0.9.1/skills/tdd/SKILL.md`]: skill("tdd", "# Middle\n"),
      }),
      "tdd",
    );
    expect(contentOf(outcome)).toContain("## New");
  });

  it("ignores another plugin's skill of the same name", () => {
    const outcome = craftContext(
      input({ [`${CACHE}/other/other-plugin/1.0.0/skills/tdd/SKILL.md`]: skill("tdd", "x") }),
      "tdd",
    );
    expect(outcome).toMatchObject({ refused: true, rule: "input/not-found" });
  });

  it("refuses an unknown skill, naming the searched paths", () => {
    const outcome = craftContext(
      input({ [`${CACHE}/bdk/bdk-craft/0.1.0/skills/tdd/SKILL.md`]: skill("tdd", "x") }),
      "debugging",
    );
    expect(outcome).toMatchObject({ refused: true, rule: "input/not-found" });
    const why = "refused" in outcome ? outcome.why : "";
    expect(why).toContain(`${PLUGIN}/plugins/bdk-craft/skills`);
    expect(why).toContain(`${CACHE}/bdk/bdk-craft/0.1.0/skills`);
  });

  it("refuses a name that is not a skill name, reading nothing outside the skills", () => {
    const outcome = craftContext(
      input({ [`${PLUGIN}/plugins/bdk-craft/SKILL.md`]: skill("x", "x") }),
      "../",
    );
    expect(outcome).toMatchObject({ refused: true, rule: "input/not-found" });
  });
});

describe("ctx craft rendering", () => {
  const files = {
    [`${PLUGIN}/plugins/bdk-craft/skills/tdd/SKILL.md`]: skill(
      "tdd",
      "# Test-driven development\n\n## Red\n\nWrite one test.\n",
    ),
    [`${PLUGIN}/plugins/bdk-craft/skills/tdd/references/zeta.md`]: "# Zeta\n\nLast.\n",
    [`${PLUGIN}/plugins/bdk-craft/skills/tdd/references/builders.md`]: "# Builders\n\nFirst.\n",
  };

  it("prints the body without frontmatter, headings one level down", () => {
    const outcome = craftContext(input(files), "tdd");
    if ("refused" in outcome) throw new Error(outcome.why);
    expect(
      outcome.content.startsWith("## Craft: tdd\n\n## Test-driven development\n\n### Red\n"),
    ).toBe(true);
    expect(outcome.content).not.toContain("description:");
    expect(outcome.parts).toStrictEqual([{ kind: "craft", source: "bdk-craft/tdd" }]);
  });

  it("inlines every reference in name order", () => {
    const outcome = craftContext(input(files), "tdd");
    if ("refused" in outcome) throw new Error(outcome.why);
    const builders = outcome.content.indexOf("### references/builders.md\n\n#### Builders");
    const zeta = outcome.content.indexOf("### references/zeta.md\n\n#### Zeta");
    expect(builders).toBeGreaterThan(0);
    expect(zeta).toBeGreaterThan(builders);
    expect(outcome.content.endsWith("Last.\n")).toBe(true);
  });
});

describe("installedCraft", () => {
  it("keeps the installed names in the order asked", () => {
    const found = installedCraft(
      input({
        [`${CACHE}/bdk/bdk-craft/0.1.0/skills/tdd/SKILL.md`]: skill("tdd", "x"),
        [`${CACHE}/bdk/bdk-craft/0.1.0/skills/debugging/SKILL.md`]: skill("debugging", "x"),
      }),
      ["debugging", "refactoring", "tdd"],
    );
    expect(found).toStrictEqual(["debugging", "tdd"]);
  });

  it("finds nothing without bdk-craft", () => {
    expect(installedCraft(input({}), ["tdd"])).toStrictEqual([]);
  });
});
