import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { renderSkillExists } from "../render/skill-exists.ts";
import { findSkill } from "../use-cases/skill-exists.ts";

const HOME = "/home/dev";
const PROJECT = "/repo";

function skill(name: string): string {
  return `---\nname: ${name}\ndescription: A skill.\n---\n\nBody.\n`;
}

function find(files: Record<string, string>, name = "caveman-commit") {
  return findSkill({ store: memoryStore(files), home: HOME, projectRoot: PROJECT }, name);
}

describe("hooks skill-exists", () => {
  it.each([
    ["the user's skills", `${HOME}/.claude/skills/commit-style/SKILL.md`],
    ["the project's skills", `${PROJECT}/.claude/skills/cc/SKILL.md`],
    ["a marketplace", `${HOME}/.claude/plugins/marketplaces/caveman/skills/cc/SKILL.md`],
    [
      "an installed plugin version",
      `${HOME}/.claude/plugins/cache/caveman/caveman/2.7.0/skills/caveman-commit/SKILL.md`,
    ],
  ])("finds a skill under %s by its frontmatter name", (_, path) => {
    expect(find({ [path]: skill("caveman-commit") })).toBe(path);
  });

  it("matches the frontmatter name, not the directory name", () => {
    expect(
      find({ [`${HOME}/.claude/skills/caveman-commit/SKILL.md`]: skill("other") }),
    ).toBeUndefined();
  });

  it("finds nothing when no root holds the skill", () => {
    expect(find({})).toBeUndefined();
  });

  it("renders an installed skill as empty content and a missing one as one line", () => {
    expect(renderSkillExists("caveman-commit", "/x/SKILL.md")).toStrictEqual({
      name: "caveman-commit",
      installed: true,
      foundIn: "/x/SKILL.md",
      content: "",
    });
    expect(renderSkillExists("caveman-commit", undefined)).toStrictEqual({
      name: "caveman-commit",
      installed: false,
      content:
        "[BDK] skill caveman-commit is not installed; the skill that needs it falls back to its own behaviour.",
    });
  });
});
