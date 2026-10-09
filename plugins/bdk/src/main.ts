// The composition root of the bdk CLI (design D8): the one place that reads `process`, wires
// the command groups into the frame with their OS boundaries and sets the exit code.

import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import { checkGroup } from "./check/index.ts";
import { configGroup } from "./config/index.ts";
import { diagnosticsGroup } from "./diagnostics/index.ts";
import { findingsGroup } from "./findings/index.ts";
import { gitGroup } from "./git/index.ts";
import { hooksGroup } from "./hooks/index.ts";
import { openspecGroup } from "./openspec/index.ts";
import { planGroup } from "./plan/index.ts";
import { rulesGroup } from "./rules/index.ts";
import { runGroup } from "./run/index.ts";
import { run } from "./shared/cli/index.ts";
import type { Group } from "./shared/cli/index.ts";
import { files } from "./shared/fs/index.ts";
import { git } from "./shared/git/index.ts";
import { shell } from "./shared/shell/index.ts";
import { readStdin } from "./shared/stdin/index.ts";

/** Replaced by `build.ts` with the `plugin.json` version. */
declare const __BDK_VERSION__: string;

/** What the slices need from the OS; each slice's group factory takes the fields it uses. */
const deps = { files, cwd: process.cwd(), home: homedir(), env: process.env };

const GROUPS: readonly Group[] = [
  checkGroup({ ...deps, shell: (command, options) => shell(command, options) }),
  configGroup(deps),
  findingsGroup({ files }),
  runGroup(deps),
  diagnosticsGroup(deps),
  // The bundle is `dist/bdk.mjs`, so the rule pack is `rules/` next to `dist/`.
  rulesGroup({ ...deps, pack: fileURLToPath(new URL("../rules", import.meta.url)) }),
  gitGroup({ ...deps, git: (cwd, args) => git(cwd, args) }),
  planGroup(deps),
  hooksGroup({ ...deps, stdin: readStdin }),
  // The bundle is `<plugin root>/dist/bdk.mjs`, so the plugin root is its parent directory.
  openspecGroup({
    files,
    cwd: deps.cwd,
    pluginRoot: fileURLToPath(new URL("..", import.meta.url)),
  }),
];

process.exitCode = await run({
  argv: process.argv.slice(2),
  version: __BDK_VERSION__,
  nodeVersion: process.versions.node,
  groups: GROUPS,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
