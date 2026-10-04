// `bdk ctx craft <name>` (T42, design D2 and D3 of `v3-t42-craft`): a skill of
// the `bdk-craft` plugin for an agent that cannot load skills itself. The
// checkout of the running plugin comes first, so a development checkout and
// an eval copy use the craft skills of their own commit; then the plugin
// cache, the highest version first. Only the directory layout is read, never
// the host's plugin bookkeeping files, as `hooks skill-exists` does.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { splitFrontmatter } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { CraftSkill } from "../domain/report.ts";

const PLUGIN = "bdk-craft";
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CraftInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly home: string;
}

/** The skill directories that may hold a craft skill, in lookup order. */
function craftSkillDirs({ store, pluginRoot, home }: CraftInput): string[] {
  const cache = join(home, ".claude", "plugins", "cache");
  const cached = subdirs(store, cache)
    .flatMap((marketplace) =>
      subdirs(store, join(cache, marketplace, PLUGIN)).map((version) => ({
        version,
        dir: join(cache, marketplace, PLUGIN, version, "skills"),
      })),
    )
    .sort((a, b) => compareVersions(b.version, a.version));
  return [join(pluginRoot, "plugins", PLUGIN, "skills"), ...cached.map(({ dir }) => dir)];
}

/** The directory of the installed craft skill `name`, or undefined. */
function findCraft(input: CraftInput, name: string): string | undefined {
  if (!SKILL_NAME.test(name)) return undefined;
  return craftSkillDirs(input)
    .map((skills) => join(skills, name))
    .find((dir) => input.store.read(join(dir, "SKILL.md")) !== undefined);
}

/** The names of `names` an installed `bdk-craft` holds, in the order given. */
export function installedCraft(input: CraftInput, names: readonly string[]): string[] {
  return names.filter((name) => findCraft(input, name) !== undefined);
}

export function readCraft(input: CraftInput, name: string): CraftSkill | Refusal {
  const dir = findCraft(input, name);
  if (dir === undefined) {
    return refuse(
      "input/not-found",
      `${name} is not a skill of an installed ${PLUGIN}; searched ${craftSkillDirs(input).join(", ")}`,
      [`claude plugin install ${PLUGIN}@bdk`, "bdk ctx craft <name>, with a skill bdk-craft ships"],
    );
  }
  const references = join(dir, "references");
  return {
    name,
    body: splitFrontmatter(input.store.read(join(dir, "SKILL.md")) ?? "").body,
    references: input.store
      .list(references)
      .filter((entry) => !entry.endsWith("/"))
      .sort()
      .map((file) => ({ file, text: input.store.read(join(references, file)) ?? "" })),
  };
}

function subdirs(store: Store, dir: string): string[] {
  return store
    .list(dir)
    .filter((entry) => entry.endsWith("/"))
    .map((entry) => entry.slice(0, -1));
}

/** Semantic versions by their numeric parts; a non-numeric part compares as text. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/);
  const pb = b.split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "";
    const y = pb[i] ?? "";
    const nx = /^\d+$/.test(x) ? Number(x) : undefined;
    const ny = /^\d+$/.test(y) ? Number(y) : undefined;
    const order = nx !== undefined && ny !== undefined ? nx - ny : x.localeCompare(y, "en");
    if (order !== 0) return order;
  }
  return 0;
}
