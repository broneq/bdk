import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR-0002: directory name = plugin name = release-please component = tag prefix.
// A plugin directory that is not a release component would never be released.

const root = join(import.meta.dirname, "..");

interface ExtraFile {
  type: string;
  path: string;
  jsonpath: string;
}

interface ReleasePleaseConfig {
  "release-type"?: string;
  "include-component-in-tag"?: boolean;
  "tag-separator"?: string;
  "separate-pull-requests"?: boolean;
  "extra-files"?: ExtraFile[];
  packages: Record<string, { component?: string }>;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function pluginDirectories(repoRoot: string): string[] {
  const plugins = join(repoRoot, "plugins");
  if (!existsSync(plugins)) return [];
  return readdirSync(plugins, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(plugins, entry.name, ".claude-plugin", "plugin.json")))
    .map((entry) => `plugins/${entry.name}`)
    .sort();
}

describe("release-please configuration", () => {
  const config = readJson("release-please-config.json") as ReleasePleaseConfig;
  const manifest = readJson(".release-please-manifest.json") as Record<string, string>;

  it("sets the shared options of ADR-0002 once for every plugin", () => {
    expect(config["release-type"]).toBe("simple");
    expect(config["include-component-in-tag"]).toBe(true);
    expect(config["tag-separator"]).toBe("--");
    expect(config["separate-pull-requests"]).toBe(true);
    expect(config["extra-files"]).toEqual([
      { type: "json", path: ".claude-plugin/plugin.json", jsonpath: "$.version" },
    ]);
  });

  it("lists every plugin directory as a package, and nothing else", () => {
    const packages = Object.keys(config.packages).sort();
    const plugins = pluginDirectories(root);
    const notReleased = plugins.filter((dir) => !packages.includes(dir));
    const notPlugins = packages.filter((dir) => !plugins.includes(dir));
    expect(notReleased, "plugin directories missing from release-please-config.json").toEqual([]);
    expect(notPlugins, "release-please packages without .claude-plugin/plugin.json").toEqual([]);
  });

  it("names each component after its directory", () => {
    for (const [path, options] of Object.entries(config.packages)) {
      expect(options.component, path).toBe(path.slice("plugins/".length));
    }
  });

  it("keeps the manifest in step with the packages", () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(config.packages).sort());
  });
});
