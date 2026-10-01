import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { pluginSkillDirs, pluginSkills } from "./plugin-skills.ts";

let root: string | undefined;
afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

function plugin(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), "bdk-plugin-skills-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("pluginSkills", () => {
  it("finds the skills of the default directory and of every manifest entry", () => {
    const dir = plugin({
      ".claude-plugin/plugin.json": JSON.stringify({
        skills: ["./skills/roles/", "./skills/stages/"],
      }),
      "skills/commit/SKILL.md": "c",
      "skills/roles/worker/SKILL.md": "w",
      "skills/stages/setup/SKILL.md": "s",
      "skills/stages/setup/references/stacks.md": "not a skill",
    });
    expect(pluginSkillDirs(dir)).toEqual(["skills", "skills/roles", "skills/stages"]);
    expect(pluginSkills(dir).map((skill) => [skill.name, skill.path])).toEqual([
      ["commit", "skills/commit/SKILL.md"],
      ["worker", "skills/roles/worker/SKILL.md"],
      ["setup", "skills/stages/setup/SKILL.md"],
    ]);
  });

  it("reads only the default directory without a manifest skills key", () => {
    const dir = plugin({ ".claude-plugin/plugin.json": "{}", "skills/commit/SKILL.md": "c" });
    expect(pluginSkillDirs(dir)).toEqual(["skills"]);
    expect(pluginSkills(dir).map((skill) => skill.text)).toEqual(["c"]);
  });
});
