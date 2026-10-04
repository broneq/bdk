// Builds everything the plugin generates, in this order: dist/bdk.mjs, the one
// file the plugin ships (design D-3 of v3-t11-kernel-skeleton), then the JSON
// Schemas under schema/ from zod (design D-10 of v3-t12-layered-config), then
// the agent adapters under agents/ with the bundle just built. None of the
// outputs is committed (`kernel-architecture`, Generated outputs): `prepare`,
// CI and the release job run this one command, and the release job publishes
// the result on the `release` branch. The build must be deterministic, because
// the published files have to equal a fresh build of the tag.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// `yaml` ships CommonJS for Node and calls `require("process")`; an ESM bundle
// has no `require`, so the bundle defines one for the CommonJS code it carries.
const cjsRequire = `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);`;

await build({
  entryPoints: ["kernel/src/main.ts"],
  outfile: "dist/bdk.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22.13",
  legalComments: "none",
  banner: { js: cjsRequire },
  logLevel: "warning",
});

// The exporter is TypeScript; bundle it next to node_modules so its external
// packages (prettier, zod) resolve, run it once, and remove it.
const exporter = resolve("node_modules/.cache/bdk/export-schemas.mjs");
await build({
  entryPoints: ["kernel/scripts/export-schemas.ts"],
  outfile: exporter,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22.13",
  packages: "external",
  logLevel: "warning",
});
try {
  await import(pathToFileURL(exporter).href);
} finally {
  rmSync(exporter, { force: true });
}

// The adapters come from the bundle, so the kernel is its own generator: the
// default `--out` is the `agents/` directory next to `dist/`.
const adapters = spawnSync(
  process.execPath,
  ["dist/bdk.mjs", "export", "agents", "--host", "claude"],
  { stdio: "inherit" },
);
if (adapters.status !== 0) {
  throw new Error(`export agents --host claude exited ${adapters.status ?? "without a status"}`);
}
