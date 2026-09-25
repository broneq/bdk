import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kit = join(import.meta.dirname, "..");
const bundles = ["dist/skill-check.mjs", "dist/index.mjs"];

describe("committed bundles", () => {
  it.each(bundles)("%s imports only node: modules", (file) => {
    const text = readFileSync(join(kit, file), "utf8");
    const specifiers = [
      ...text.matchAll(
        /(?:^|[\s;])(?:import|export)\b[^"';]*?\bfrom\s*"([^"]+)"|\bimport\s*\(\s*"([^"]+)"\s*\)/gm,
      ),
    ].map((m) => m[1] ?? m[2]);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => !s?.startsWith("node:"))).toEqual([]);
  });

  it("declares the public surface in one self-contained file", () => {
    const text = readFileSync(join(kit, "dist/index.d.ts"), "utf8");
    expect(text).toContain("export declare function defineConfig(config: Config): Config;");
    expect(text).not.toMatch(/from\s+"\./);
  });
});
