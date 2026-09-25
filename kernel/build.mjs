// Builds dist/bdk.mjs, the one file the plugin ships (design D-3 of
// v3-t11-kernel-skeleton). The output is committed; CI rebuilds it and fails
// on `git diff --exit-code dist/`, so the build must be deterministic.
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
