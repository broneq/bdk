import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { build } from "../build.ts";

// End-to-end test of the built CLI (design D10): a copy of the plugin outside the workspace, so
// no node_modules is in reach, built by `build.ts` and run through `bin/bdk` the way the Bash
// tool runs it, from another working directory.

const PLUGIN = join(import.meta.dirname, "..");
const VERSION = (
  JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")) as {
    version: string;
  }
).version;

let root: string;
let plugin: string;
let elsewhere: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "bdk-cli-"));
  plugin = join(root, "plugin");
  elsewhere = join(root, "elsewhere");
  for (const dir of [".claude-plugin", "bin"]) {
    cpSync(join(PLUGIN, dir), join(plugin, dir), { recursive: true });
  }
  cpSync(join(PLUGIN, "bin"), join(root, "unbuilt", "bin"), { recursive: true });
  mkdirSync(elsewhere);
  symlinkSync(join(plugin, "bin", "bdk"), join(root, "bdk-link"));
  await build({ outfile: join(plugin, "dist", "bdk.mjs") });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function bdk(
  launcher: string,
  args: readonly string[],
): { status: number | null; stdout: string; stderr: string } {
  const { status, stdout, stderr } = spawnSync(launcher, args, {
    cwd: elsewhere,
    encoding: "utf8",
  });
  return { status, stdout, stderr };
}

describe("bin/bdk", () => {
  it("prints the plugin.json version", () => {
    expect(bdk(join(plugin, "bin", "bdk"), ["--version"])).toEqual({
      status: 0,
      stdout: `${VERSION}\n`,
      stderr: "",
    });
  });

  it("runs through a symbolic link", () => {
    expect(bdk(join(root, "bdk-link"), ["--version"]).stdout).toBe(`${VERSION}\n`);
  });

  it("prints the help", () => {
    const { status, stdout, stderr } = bdk(join(plugin, "bin", "bdk"), ["--help"]);
    expect(status).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: bdk <group> [<verb>] [arguments] [flags]");
  });

  it("refuses an unknown command in text and in JSON", () => {
    expect(bdk(join(plugin, "bin", "bdk"), ["nope"])).toEqual({
      status: 2,
      stdout: "",
      stderr: "bdk: unknown command group nope\nhint: Run bdk --help for the command groups.\n",
    });
    const asJson = bdk(join(plugin, "bin", "bdk"), ["nope", "--json"]);
    expect(asJson.status).toBe(2);
    expect(asJson.stderr).toBe("");
    expect(JSON.parse(asJson.stdout)).toEqual({
      error: {
        code: "usage/unknown-command",
        message: "unknown command group nope",
        hint: "Run bdk --help for the command groups.",
      },
    });
  });

  it("finishes while stdin stays open", async () => {
    const child = spawn(join(plugin, "bin", "bdk"), ["--help"], { cwd: elsewhere, stdio: "pipe" });
    const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
    child.stdin.destroy();
    expect(code).toBe(0);
  });

  it("renders a run from the project files", () => {
    const write = (path: string, text: string): void => {
      mkdirSync(join(elsewhere, path, ".."), { recursive: true });
      writeFileSync(join(elsewhere, path), text);
    };
    write(
      ".bdk/runs/run.json",
      JSON.stringify({
        version: 1,
        mode: "interactive",
        queue: [{ change: "v3-1-demo", issue: 1 }],
        current: "v3-1-demo",
      }),
    );
    write("openspec/changes/v3-1-demo/proposal.md", "# Proposal\n");
    write("openspec/changes/v3-1-demo/design.md", "# Design\n");
    write(".bdk/runs/v3-1-demo/design/verify-1.md", "Verdict: FAIL\n");
    const { status, stdout, stderr } = bdk(join(plugin, "bin", "bdk"), ["run", "status", "--json"]);
    rmSync(join(elsewhere, ".bdk"), { recursive: true });
    rmSync(join(elsewhere, "openspec"), { recursive: true });
    expect({ status, stderr }).toEqual({ status: 0, stderr: "" });
    expect(JSON.parse(stdout)).toEqual({
      mode: "interactive",
      current: "v3-1-demo",
      changes: [
        {
          change: "v3-1-demo",
          issue: 1,
          current: true,
          stage: "design",
          step: null,
          row: 2,
          round: null,
          reason: "design/verify-1.md does not pass",
        },
      ],
      parts: [],
      warnings: [],
    });
  });

  it("exits 3 with one repair line when the bundle is missing", () => {
    const { status, stdout, stderr } = bdk(join(root, "unbuilt", "bin", "bdk"), ["--version"]);
    expect(status).toBe(3);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/^bdk: .*dist\/bdk\.mjs is missing; .*\n$/);
    expect(stderr.split("\n")).toHaveLength(2);
  });
});
