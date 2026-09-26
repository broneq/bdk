// The index skeleton (design D-3, D-6): created on first open under
// `.bdk/.machine/`, `node:sqlite` loaded lazily and without its warning.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { INDEX_SCHEMA_VERSION, openIndex } from "../index.ts";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-index-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("openIndex", () => {
  it("creates the database with the schema version and a busy timeout", async () => {
    const index = await openIndex(root);
    try {
      expect(index.path).toBe(join(root, ".bdk/.machine/index.sqlite"));
      expect(existsSync(index.path)).toBe(true);
      expect(index.schemaVersion()).toBe(INDEX_SCHEMA_VERSION);
      expect(index.database.prepare("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 });
    } finally {
      index.close();
    }
  });

  it("keeps the recorded version on a second open", async () => {
    (await openIndex(root)).close();
    const index = await openIndex(root);
    expect(index.schemaVersion()).toBe(INDEX_SCHEMA_VERSION);
    index.close();
  });

  it("prints nothing on stderr, not even node:sqlite's ExperimentalWarning", async () => {
    const entry = join(root, "entry.ts");
    const store = fileURLToPath(new URL("../index.ts", import.meta.url));
    writeFileSync(
      entry,
      `import { openIndex } from ${JSON.stringify(store)};\n` +
        `const index = await openIndex(${JSON.stringify(root)});\n` +
        `process.stdout.write(String(index.schemaVersion()));\nindex.close();\n`,
    );
    const outfile = join(root, "entry.mjs");
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      // The same banner as kernel/build.mjs: the store now carries `yaml`,
      // whose CommonJS code calls `require`.
      banner: {
        js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
      },
      logLevel: "silent",
    });
    const result = spawnSync(process.execPath, [outfile], { encoding: "utf8" });
    expect(result.stdout).toBe(String(INDEX_SCHEMA_VERSION));
    expect(result.stderr).toBe("");
  });
});
