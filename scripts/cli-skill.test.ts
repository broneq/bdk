import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { bdkGroups } from "./docs-reference/model.ts";

// The `/bdk:cli` skill follows the CLI (spec `bdk-cli-skill`, "The skill follows the CLI"): it is
// a written mapping from questions to commands, so a new, renamed or removed command must fail
// here until the skill follows.

const SKILL = join(import.meta.dirname, "../plugins/bdk/skills/cli/SKILL.md");

/** `bdk <group> <verb>` for each command; `bdk <group>` for a group with a single unnamed verb. */
async function declared(): Promise<string[]> {
  const groups = await bdkGroups();
  return groups.flatMap((group) =>
    group.commands.map((command) =>
      command.verb === undefined ? `bdk ${group.name}` : `bdk ${group.name} ${command.verb}`,
    ),
  );
}

it("names every command the bdk CLI declares", async () => {
  const text = readFileSync(SKILL, "utf8");
  const missing = (await declared()).filter((command) => !text.includes(`\`${command}`));
  expect(missing, "Add these commands to plugins/bdk/skills/cli/SKILL.md.").toEqual([]);
});

it("names no bdk command the CLI lacks", async () => {
  const text = readFileSync(SKILL, "utf8");
  const known = new Set(await declared());
  const groups = new Set((await bdkGroups()).map((group) => group.name));
  const stale = [...text.matchAll(/`bdk ([a-z]+) ([a-z][a-z-]*)/g)]
    .filter((match) => groups.has(match[1] ?? ""))
    .map((match) => `bdk ${match[1]} ${match[2]}`)
    .filter((command) => !known.has(command));
  expect(stale, "Remove or rename these commands in plugins/bdk/skills/cli/SKILL.md.").toEqual([]);
});
