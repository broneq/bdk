// Builds the three bundles: dist/skill-check.mjs (the CLI), dist/index.mjs (the
// library that configs and plugins import) and dist/testing.mjs (the rule
// tester), plus the type declarations of the two library entries. dist/ is not
// committed: the release job builds it onto the release branch, and the test
// suite's global setup builds it before the tests that run the bundles.
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type BuildOptions } from "esbuild";

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
} satisfies BuildOptions;

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

await build({
  ...common,
  entryPoints: ["src/testing.ts"],
  outfile: "dist/testing.mjs",
  banner: { js: cjsRequire },
});

// tsc emits declarations for every module the entries import, so it writes to
// a scratch directory and only the two public files are kept. src/index.ts
// imports nothing relative, so dist/index.d.ts is self-contained;
// dist/testing.d.ts imports its types from it.
const declarations = mkdtempSync(join(tmpdir(), "skill-check-dts-"));
try {
  execFileSync(
    "tsc",
    [
      "src/index.ts",
      "src/testing.ts",
      "--ignoreConfig",
      "--declaration",
      "--emitDeclarationOnly",
      "--allowImportingTsExtensions",
      "--outDir",
      declarations,
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
  copyFileSync(join(declarations, "index.d.ts"), "dist/index.d.ts");
  const testing = readFileSync(join(declarations, "testing.d.ts"), "utf8");
  writeFileSync("dist/testing.d.ts", testing.replace('from "./index.ts"', 'from "./index.js"'));
} finally {
  rmSync(declarations, { recursive: true, force: true });
}
