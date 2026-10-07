// The composition root of the bdk CLI (design D8): the one place that reads `process`, wires
// the command groups into the frame and sets the exit code.

import { findingsGroup } from "./findings/index.ts";
import { run } from "./shared/cli/index.ts";
import type { Group } from "./shared/cli/index.ts";
import { files } from "./shared/fs/index.ts";

/** Replaced by `build.ts` with the `plugin.json` version. */
declare const __BDK_VERSION__: string;

const GROUPS: readonly Group[] = [findingsGroup({ files })];

process.exitCode = await run({
  argv: process.argv.slice(2),
  version: __BDK_VERSION__,
  nodeVersion: process.versions.node,
  groups: GROUPS,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
