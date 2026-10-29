import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The kit installs as a git dependency on a `release` commit (ADR-0027): its package.json is
// what a consumer installs, so it carries no version (plugin.json is the only one), runs
// nothing on install, and exposes the CLI and the two library entries.

const kit = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(kit, "package.json"), "utf8")) as Record<string, unknown>;

describe("package.json of the kit", () => {
  it("carries no version", () => {
    expect(pkg).not.toHaveProperty("version");
  });

  it("declares no script that runs on install", () => {
    const scripts = Object.keys(pkg.scripts ?? {});
    const lifecycle = ["preinstall", "install", "postinstall", "prepare", "prepublish"];
    expect(scripts.filter((name) => lifecycle.includes(name))).toEqual([]);
  });

  it("exposes skill-check, the library and the rule tester", () => {
    expect(pkg.bin).toEqual({ "skill-check": "dist/skill-check.mjs" });
    expect(Object.keys(pkg.exports as Record<string, unknown>)).toEqual([".", "./testing"]);
  });

  it("leaves bin/ out of the plugin, whose skill runs the bundle by its path", () => {
    expect(existsSync(join(kit, "bin"))).toBe(false);
  });
});
