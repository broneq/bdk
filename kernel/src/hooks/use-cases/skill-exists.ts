// `bdk hooks skill-exists <name>` (design D-9): a SKILL.md whose frontmatter
// `name` is `<name>`, under the user's and the project's skills, every
// marketplace and every installed plugin version. Only the directory layout
// is read, never the host's plugin bookkeeping files.
import { join } from "node:path";
import { parse } from "yaml";

import { splitFrontmatter } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";

export interface SkillExistsInput {
  readonly store: Store;
  readonly home: string;
  readonly projectRoot: string;
}

/** The SKILL.md of the skill named `name`, or undefined when none is installed. */
export function findSkill(input: SkillExistsInput, name: string): string | undefined {
  for (const skills of skillDirs(input)) {
    for (const entry of subdirs(input.store, skills)) {
      const file = join(skills, entry, "SKILL.md");
      const text = input.store.read(file);
      if (text !== undefined && frontmatterName(text) === name) return file;
    }
  }
  return undefined;
}

function skillDirs({ store, home, projectRoot }: SkillExistsInput): string[] {
  const plugins = join(home, ".claude", "plugins");
  const marketplaces = join(plugins, "marketplaces");
  const cache = join(plugins, "cache");
  const versions = subdirs(store, cache).flatMap((marketplace) =>
    subdirs(store, join(cache, marketplace)).flatMap((plugin) =>
      subdirs(store, join(cache, marketplace, plugin)).map((version) =>
        join(cache, marketplace, plugin, version),
      ),
    ),
  );
  return [
    join(home, ".claude", "skills"),
    join(projectRoot, ".claude", "skills"),
    ...subdirs(store, marketplaces).map((marketplace) => join(marketplaces, marketplace, "skills")),
    ...versions.map((version) => join(version, "skills")),
  ];
}

function subdirs(store: Store, dir: string): string[] {
  return store
    .list(dir)
    .filter((entry) => entry.endsWith("/"))
    .map((entry) => entry.slice(0, -1));
}

function frontmatterName(text: string): string | undefined {
  const { frontmatter } = splitFrontmatter(text);
  if (frontmatter === undefined) return undefined;
  try {
    const data: unknown = parse(frontmatter);
    const name =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>).name
        : undefined;
    return typeof name === "string" ? name : undefined;
  } catch {
    // Another plugin's broken frontmatter is not this hook's problem.
    return undefined;
  }
}
