import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kit = join(import.meta.dirname, "..");
const bundles = ["dist/skill-check.mjs", "dist/index.mjs", "dist/testing.mjs"];

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

  it("declares the rule tester against the public surface", () => {
    const text = readFileSync(join(kit, "dist/testing.d.ts"), "utf8");
    expect(text).toContain("export declare function checkRule<");
    const specifiers = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers).toEqual(["./index.js"]);
  });

  it("keeps the rule tester out of the main entry", () => {
    const text = readFileSync(join(kit, "dist/index.mjs"), "utf8");
    expect(text).not.toContain("checkRule");
    expect(text).not.toContain("mkdtemp");
  });
});
