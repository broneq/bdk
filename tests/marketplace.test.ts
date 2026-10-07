import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `claude plugin validate` does not open remote sources, so a git-subdir entry
// on this repository is checked here: it must name a plugin directory whose
// manifest has the entry's name (marketplace spec).

const root = join(import.meta.dirname, "..");
const thisRepository = "broneq/bdk";

interface Entry {
  name: string;
  source: string | { source: string; url?: string; path?: string; ref?: string };
}

const marketplace = JSON.parse(
  readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8"),
) as { plugins: Entry[] };

const localEntries = marketplace.plugins.filter(
  (entry) =>
    typeof entry.source === "object" &&
    entry.source.source === "git-subdir" &&
    entry.source.url === thisRepository,
);

describe("marketplace entries of this repository", () => {
  it("install git-identity and bdk-skill-kit from plugins/<name> on the release branch", () => {
    for (const name of ["git-identity", "bdk-skill-kit"]) {
      const entry = marketplace.plugins.find((plugin) => plugin.name === name);
      expect(entry?.source, name).toEqual({
        source: "git-subdir",
        url: thisRepository,
        path: `plugins/${name}`,
        ref: "release",
      });
    }
  });

  it("each names a plugin directory whose manifest has the entry's name", () => {
    for (const entry of localEntries) {
      const path = typeof entry.source === "object" ? (entry.source.path ?? "") : "";
      expect(path, entry.name).toBe(`plugins/${entry.name}`);
      const manifest = join(root, path, ".claude-plugin", "plugin.json");
      expect(existsSync(manifest), `${entry.name}: ${path} has no plugin.json`).toBe(true);
      const { name } = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
      expect(name, `${entry.name}: manifest name`).toBe(entry.name);
    }
  });
});
