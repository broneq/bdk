import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every plugin runs on the root toolchain (repo-sdlc): a tool config, lockfile
// or workflow directory inside a plugin would be ignored by CI or fight the
// root one.

const root = join(import.meta.dirname, "..");

const FORBIDDEN = [
  /^\.github$/,
  /^\.husky$/,
  /^biome\.jsonc?$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^prettier\.config\./,
  /^vitest\.config\./,
  /^vitest\.workspace\./,
  /^commitlint\.config\./,
  /^knip\.jsonc?$/,
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  /^pnpm-workspace\.yaml$/,
];

function pluginDirectories(): string[] {
  const plugins = join(root, "plugins");
  if (!existsSync(plugins)) return [];
  return readdirSync(plugins, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("plugins", entry.name));
}

describe("plugin directories", () => {
  it("carry no tool config, lockfile or workflow of their own", () => {
    const found = pluginDirectories().flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((name) => FORBIDDEN.some((pattern) => pattern.test(name)))
        .map((name) => `${dir}/${name}`),
    );
    expect(found).toEqual([]);
  });
});
