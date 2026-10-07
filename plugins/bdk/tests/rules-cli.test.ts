import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { build } from "../build.ts";
import { forSchema } from "../src/rules/schema/for.ts";

// `bdk rules for` end to end (spec `bdk-cli/rules`): a copy of the plugin with its rule pack,
// built by `build.ts`, run through `bin/bdk` from a temporary project.

const PLUGIN = join(import.meta.dirname, "..");

let root: string;
let plugin: string;
let project: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "bdk-rules-"));
  plugin = join(root, "plugin");
  project = join(root, "project");
  for (const dir of [".claude-plugin", "bin", "rules"]) {
    cpSync(join(PLUGIN, dir), join(plugin, dir), { recursive: true });
  }
  await build({ outfile: join(plugin, "dist", "bdk.mjs") });
  write(join(project, ".bdk", "settings.yaml"), "languages: [typescript, react]\n");
  write(join(project, "openspec", "config.yaml"), "schema: spec-driven\n");
  write(
    join(project, ".bdk", "rules", "UI-1.md"),
    "---\nkind: house\npaths: [src/**/*.tsx]\nstages: [review]\n---\n\nUse the design tokens.\n",
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function bdk(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const { status, stdout, stderr } = spawnSync(join(plugin, "bin", "bdk"), args, {
    cwd: project,
    encoding: "utf8",
  });
  return { status, stdout, stderr };
}

describe("bdk rules for, built", () => {
  it("selects the general, TypeScript, React and project rules of a review of a .tsx file", () => {
    const { status, stdout, stderr } = bdk([
      "rules",
      "for",
      "--stage",
      "review",
      "--files",
      "src/App.tsx",
      "--json",
    ]);
    expect([status, stderr]).toEqual([0, ""]);
    const result = forSchema.parse(JSON.parse(stdout));
    expect(result.rules.map((rule) => rule.id)).toEqual([
      "BDK-ARCH-3",
      "BDK-ARCH-4",
      "BDK-CQ-1",
      "BDK-CQ-4",
      "BDK-DP-2",
      "BDK-DP-4",
      "BDK-DP-8",
      "BDK-REACT-2",
      "BDK-REACT-9",
      "BDK-REACT-10",
      "BDK-REACT-14",
      "BDK-REACT-15",
      "BDK-REACT-17",
      "BDK-REACT-19",
      "BDK-TS-7",
      "UI-1",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("leaves the React rules out for a .ts file and the language packs out of a design", () => {
    const review = bdk(["rules", "for", "--stage", "review", "--files", "src/util.ts", "--json"]);
    const ids = forSchema.parse(JSON.parse(review.stdout)).rules.map((rule) => rule.id);
    expect(ids.filter((id) => id.startsWith("BDK-REACT") || id === "UI-1")).toEqual([]);
    expect(ids).toContain("BDK-TS-7");
    const design = bdk(["rules", "for", "--stage", "design", "--json"]);
    expect(forSchema.parse(JSON.parse(design.stdout)).rules.map((rule) => rule.id)).toEqual([
      "BDK-ARCH-3",
      "BDK-ARCH-4",
    ]);
  });
});
