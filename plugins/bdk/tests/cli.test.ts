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

  it("runs a git command from the bundle in a repository", () => {
    const repo = join(root, "repo");
    mkdirSync(join(repo, "plan"), { recursive: true });
    const git = (...args: string[]): void => {
      spawnSync("git", ["-c", "user.name=bdk", "-c", "user.email=bdk@example.com", ...args], {
        cwd: repo,
      });
    };
    git("init", "-q", "-b", "main");
    git("commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "base");
    writeFileSync(join(repo, "plan", "01.md"), "---\nfiles: [plan/01.md]\n---\n");
    git("add", "-A");
    git("commit", "-q", "--no-gpg-sign", "-m", "part");
    const { status, stdout, stderr } = spawnSync(
      join(plugin, "bin", "bdk"),
      ["git", "groups", "HEAD~1", "--plan", "plan", "--json"],
      { cwd: repo, encoding: "utf8" },
    );
    expect({ status, stderr }).toEqual({ status: 0, stderr: "" });
    expect((JSON.parse(stdout) as { groups: { id: string }[] }).groups.map((g) => g.id)).toEqual([
      "p01",
      "integration",
    ]);
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

describe("bin/bdk config", () => {
  // A project and a home directory of their own, so the user's real global layer is never read.
  function project(files: Readonly<Record<string, string>>): string {
    const dir = mkdtempSync(join(root, "project-"));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return dir;
  }

  function config(cwd: string, args: readonly string[]) {
    const home = join(root, "home");
    const { status, stdout, stderr } = spawnSync(join(plugin, "bin", "bdk"), ["config", ...args], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, "xdg") },
    });
    return { status, stdout, stderr };
  }

  it("shows values with their origin layer from a subdirectory", () => {
    const dir = project({
      ".bdk/settings.yaml": "languages: [typescript]\n",
      ".bdk/settings.local.yaml": "execution:\n  lead: foreground\n",
      "openspec/config.yaml": "schema: spec-driven\n",
      "src/deep/.keep": "",
    });
    const { status, stdout, stderr } = config(join(dir, "src", "deep"), ["show"]);
    expect([status, stderr]).toEqual([0, ""]);
    expect(stdout).toContain('languages: ["typescript"]  # project\n');
    expect(stdout).toContain('execution.lead: "foreground"  # local\n');
    expect(stdout).toContain("plan.part.max-tasks: 5  # default\n");
  });

  it("prints the stop line with exit 0 in a project without a configuration", () => {
    expect(config(project({ "README.md": "" }), ["show"])).toEqual({
      status: 0,
      stdout: "BDK not configured: run /bdk:setup\n",
      stderr: "",
    });
  });

  it("rejects an invalid value naming its key, and sets a valid one", () => {
    const dir = project({
      ".bdk/settings.yaml": "plan:\n  part:\n    max-files: many\n",
      "openspec/x": "",
    });
    const checked = config(dir, ["check"]);
    expect(checked.status).toBe(1);
    expect(checked.stdout).toMatch(/\.bdk\/settings\.yaml: plan\.part\.max-files: /);
    expect(config(dir, ["set", "plan.part.max-files", "12"]).status).toBe(0);
    expect(config(dir, ["check"]).status).toBe(0);
    expect(config(dir, ["show", "plan.part.max-files"]).stdout).toMatch(
      /\nplan\.part\.max-files: 12 {2}# project\n$/,
    );
  });
});
