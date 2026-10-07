// `bdk openspec install`: copies the BDK OpenSpec schema the plugin ships into the project's
// `openspec/schemas/bdk/` (spec `bdk-cli/openspec`). `/bdk:setup` calls it because the host asks
// the user to approve `cp -R` even under an allow rule (design D7 of v3-181-bdk-setup).

import { join } from "node:path";

import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import type { InstallResult } from "../schema/install.ts";
import { readFile, readTree, SCHEMA_DIR, writeFile } from "../store/schema.ts";

export interface OpenspecDeps {
  readonly files: Files;
  /** The project root: the working directory of the command. */
  readonly cwd: string;
  /** The directory of the installed plugin, holding `openspec/schemas/bdk/`. */
  readonly pluginRoot: string;
}

export function install({ files, cwd, pluginRoot }: OpenspecDeps): InstallResult {
  const source = join(pluginRoot, SCHEMA_DIR);
  const shipped = readTree(files, source);
  if (!shipped.some((file) => file.path === "schema.yaml")) {
    throw new CliError(
      "env/schema-missing",
      `the plugin ships no BDK OpenSpec schema: ${source}/schema.yaml is missing`,
      "Reinstall the bdk plugin.",
    );
  }
  const target = join(cwd, SCHEMA_DIR);
  return {
    schema: "bdk",
    target: SCHEMA_DIR,
    files: shipped.map(({ path, text }) => {
      const current = readFile(files, target, path);
      if (current === text) return { path, status: "unchanged" as const };
      writeFile(files, target, path, text);
      return { path, status: current === undefined ? ("added" as const) : ("updated" as const) };
    }),
  };
}
