import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readVersions } from "../../harness/paths.ts";
import { BUNDLE } from "../execute-ab/seed.ts";
import { seedPatches } from "../stages/seeds.ts";
import { writePreimages } from "../stages/testing.ts";
import { parseKey, readKey } from "./key.ts";
import { CELLS, checkKey, describeSeries, seedBase } from "./suite.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-review-models-"));
  dirs.push(dir);
  return dir;
}

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, env: ENV, encoding: "utf8" });
}

function bdk(dir: string, configHome: string, ...args: string[]): unknown {
  const stdout = execFileSync("node", [BUNDLE, ...args, "--json"], {
    cwd: dir,
    env: { ...ENV, XDG_CONFIG_HOME: configHome },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as unknown;
}

describe("describeSeries", () => {
  it("runs /bdk:cr from the one base in three cells that differ only in the plugin copy", () => {
    const cell = (name: string) => ({
      plugin: `/plugins/${name}`,
      bdkCommit: "c".repeat(40),
      variantHash: name,
    });
    const setup = describeSeries({
      series: "probe",
      dir: "/runs/s",
      sandbox: "/sandbox",
      cells: Object.fromEntries(Object.keys(CELLS).map((name) => [name, cell(name)])),
      base: "/sandbox/base",
      versions: readVersions(),
      runs: 1,
      runCapUsd: 3,
      resultsFile: "/results/rows.jsonl",
    });
    expect(CELLS).toStrictEqual({ sonnet: "sonnet", "sonnet-prime": "sonnet", opus: "opus" });
    expect(Object.keys(setup.cells)).toStrictEqual(["sonnet", "sonnet-prime", "opus"]);
    expect(setup.prompt).toBe("{{bdk_prompt}}");
    expect(setup.items).toStrictEqual([{ id: "review", vars: { bdk_prompt: "/bdk:cr" } }]);
    const opus = setup.cells.opus;
    expect(opus?.plan).toMatchObject({
      workDir: "/sandbox/work/opus",
      fixtureBase: "/sandbox/base",
      provenance: { variantHash: "opus" },
      settings: { bundle: "/plugins/opus/dist/bdk.mjs", configHome: "/sandbox/config-home" },
    });
    expect(() =>
      describeSeries({
        series: "probe",
        dir: "/runs/s",
        sandbox: "/sandbox",
        cells: {},
        base: "/sandbox/base",
        versions: readVersions(),
        runs: 1,
        runCapUsd: 3,
        resultsFile: "/results/rows.jsonl",
      }),
    ).toThrow(/no plugin copy for cell sonnet/);
  });
});

describe("checkKey", () => {
  it("accepts the shipped key and names a defect outside the seed", () => {
    expect(() => {
      checkKey();
    }).not.toThrow();
    const key = readKey();
    const broken = parseKey(
      readFileSync(join(import.meta.dirname, "key.yaml"), "utf8").replace(
        "file: src/ui/asyncState.test.ts",
        "file: src/ui/other.ts",
      ),
      "key.yaml",
    );
    expect(key.defects).toHaveLength(broken.defects.length);
    expect(() => {
      checkKey(broken);
    }).toThrow(/blank-title-case: src\/ui\/other\.ts is not a file the seed/);
  });
});

// The seed spawns about twenty kernel and git processes.
describe("seedBase", { timeout: 60_000 }, () => {
  it("delivers the defects with the tasks, commits the settings, and leaves /bdk:cr next", () => {
    const key = readKey();
    const base = temp();
    git(base, "init", "-q", "-b", "feat/eval");
    git(base, "config", "user.name", "BDK Eval");
    git(base, "config", "user.email", "eval@bdk.invalid");
    writePreimages(
      base,
      seedPatches(key.seed).map((file) => readFileSync(file, "utf8")),
    );
    git(base, "add", "--all");
    git(base, "commit", "-q", "-m", "fixture files");
    const configHome = temp();
    seedBase(base, { bundle: BUNDLE, configHome }, key);
    expect(git(base, "log", "-1", "--format=%s").trim()).toBe("chore(bdk): project settings");
    const tasks = git(base, "log", "--format=%(trailers:key=BDK-Task,valueonly)", "--reverse")
      .split("\n")
      .filter(Boolean);
    expect(tasks).toStrictEqual(["01-1", "02-1"]);
    expect(git(base, "status", "--porcelain")).toBe("");
    expect(readFileSync(join(base, "src/ui/asyncState.ts"), "utf8")).toContain("status < 500");
    expect(bdk(base, configHome, "next")).toMatchObject({ command: "/bdk:cr" });
    const settings = readFileSync(join(base, ".bdk/settings.yaml"), "utf8");
    expect(settings).toMatch(/lavish: false/);
    expect(settings).toMatch(/npx vitest run/);
    expect(settings).toMatch(/npx eslint \./);
  });
});
