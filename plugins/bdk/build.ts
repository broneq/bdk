// Builds the bdk CLI into one self-contained file, `dist/bdk.mjs` (design D3 of
// v3-178-bdk-plugin-skeleton). Run as `node build.ts`; the end-to-end test imports `build`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = import.meta.dirname;

export async function build({ outfile = join(ROOT, "dist", "bdk.mjs") } = {}): Promise<void> {
  const { version } = JSON.parse(
    readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"),
  ) as {
    version: string;
  };
  await esbuild.build({
    entryPoints: [join(ROOT, "src", "main.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22.18",
    outfile,
    define: { __BDK_VERSION__: JSON.stringify(version) },
    logLevel: "warning",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
