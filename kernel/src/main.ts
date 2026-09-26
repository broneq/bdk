// Composition root: binds the registry to the process. Everything a handler
// may throw is already turned into its mode's shape by the registry; what
// reaches the catch here is a kernel bug, reported as exit 1 with the stack.
import commands from "../../schema/cli/commands.json" with { type: "json" };
import { homedir } from "node:os";

import { registrations, settingsRegistry } from "./registrations.ts";
import { pluginRootOf } from "./shared/config/index.ts";
import { findWorkTree } from "./shared/git/index.ts";
import { createRegistry, loadIndex } from "./shared/registry/index.ts";
import { fileStore, findExecutable } from "./shared/store/index.ts";

const index = loadIndex(commands);
const registry = createRegistry(
  index,
  registrations({
    store: fileStore(),
    pluginRoot: pluginRootOf(import.meta.url),
    contract: index.contract,
    settings: settingsRegistry(),
  }),
);

try {
  process.exitCode = await registry.run({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    runtime: {
      nodeVersion: process.versions.node,
      env: process.env,
      platform: process.platform,
      home: homedir(),
      workTree: findWorkTree,
      which: (name) => findExecutable(name, { env: process.env, platform: process.platform }),
    },
    streams: {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    },
  });
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
}
