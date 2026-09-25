// Builds the two committed bundles: dist/skill-check.mjs (the CLI) and
// dist/index.mjs (the library that configs and plugins import), plus the
// library's type declarations. CI rebuilds them and fails on
// `git diff --exit-code dist/`, so the build must be deterministic.
import { execFileSync } from "node:child_process";
import { chmodSync, rmSync } from "node:fs";
import { build } from "esbuild";

// `yaml` ships CommonJS for Node and calls `require("process")`; an ESM bundle
// has no `require`, so the bundle defines one for the CommonJS code it carries.
const cjsRequire = `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);`;

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22.18",
  legalComments: "none",
  logLevel: "warning",
};

await build({
  ...common,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/skill-check.mjs",
  banner: { js: `#!/usr/bin/env node\n${cjsRequire}` },
});
chmodSync("dist/skill-check.mjs", 0o755);

await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  banner: { js: cjsRequire },
});

// src/index.ts is the whole public surface and imports nothing relative, so
// its declarations are one self-contained file.
execFileSync(
  "tsc",
  [
    "src/index.ts",
    "--ignoreConfig",
    "--declaration",
    "--emitDeclarationOnly",
    "--outDir",
    "dist",
    "--module",
    "nodenext",
    "--target",
    "es2023",
    "--types",
    "node",
    "--strict",
    "--skipLibCheck",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
