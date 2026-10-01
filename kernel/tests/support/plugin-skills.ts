// The skills the host loads from a plugin: the default `skills/` directory
// plus every directory of the manifest's `skills` array, which adds to the
// default scan (plugins reference, Fields). Tests that check every skill read
// them from here, so a new skill directory cannot escape a check.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PluginSkill {
  /** The directory name, which is the skill name. */
  readonly name: string;
  /** `SKILL.md` relative to the plugin root. */
  readonly path: string;
  readonly text: string;
}

/** The skill directories relative to the plugin root, `skills` first. */
export function pluginSkillDirs(root: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
  ) as { skills?: string | string[] };
  const listed = manifest.skills === undefined ? [] : [manifest.skills].flat();
  const dirs = ["skills", ...listed.map((dir) => dir.replace(/^\.\//, "").replace(/\/$/, ""))];
  return [...new Set(dirs)];
}

export function pluginSkills(root: string): PluginSkill[] {
  return pluginSkillDirs(root).flatMap((dir) =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, dir, entry.name, "SKILL.md")))
      .map((entry) => {
        const path = `${dir}/${entry.name}/SKILL.md`;
        return { name: entry.name, path, text: readFileSync(join(root, path), "utf8") };
      }),
  );
}
