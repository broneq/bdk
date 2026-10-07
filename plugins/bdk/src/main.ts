// The composition root of the bdk CLI (design D8): the one place that reads `process`, wires
// the command groups into the frame with their OS boundaries and sets the exit code.

import { homedir } from "node:os";

import { configGroup } from "./config/index.ts";
import { findingsGroup } from "./findings/index.ts";
import { gitGroup } from "./git/index.ts";
import { runGroup } from "./run/index.ts";
import { run } from "./shared/cli/index.ts";
import type { Group } from "./shared/cli/index.ts";
import { files } from "./shared/fs/index.ts";
import { git } from "./shared/git/index.ts";

/** Replaced by `build.ts` with the `plugin.json` version. */
declare const __BDK_VERSION__: string;

/** What the slices need from the OS; each slice's group factory takes the fields it uses. */
const deps = { files, cwd: process.cwd(), home: homedir(), env: process.env };

const GROUPS: readonly Group[] = [
  configGroup(deps),
  findingsGroup({ files }),
  runGroup(deps),
  gitGroup({ ...deps, git: (cwd, args) => git(cwd, args) }),
];

process.exitCode = await run({
  argv: process.argv.slice(2),
  version: __BDK_VERSION__,
  nodeVersion: process.versions.node,
  groups: GROUPS,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
