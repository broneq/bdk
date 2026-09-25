// Composition root: binds the registry to the process. Everything a handler
// may throw is already turned into its mode's shape by the registry; what
// reaches the catch here is a kernel bug, reported as exit 1 with the stack.
import commands from "../../schema/cli/commands.json" with { type: "json" };
import { registrations } from "./registrations.ts";
import { findWorkTree } from "./shared/git/index.ts";
import { createRegistry, loadIndex } from "./shared/registry/index.ts";

const registry = createRegistry(loadIndex(commands), registrations);

try {
  process.exitCode = await registry.run({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    runtime: { nodeVersion: process.versions.node, workTree: findWorkTree },
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
