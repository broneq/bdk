// Builds dist/bdk.mjs, the one file the plugin ships (design D-3 of
// v3-t11-kernel-skeleton), then regenerates the JSON Schemas under schema/
// from zod (design D-10 of v3-t12-layered-config). Both outputs are
// committed; CI rebuilds them and fails on `git diff --exit-code dist/
// schema/`, so the build must be deterministic.
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
