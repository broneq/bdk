// `kernel-architecture`, Generated outputs and Distribution ref: git tracks no
// file that `pnpm build` generates (the bundle, the generated schemas, the
// generated adapters) except on the distribution ref, the hand-written schemas
// stay tracked, and the marketplace installs the plugin from the `release`
// branch, where the release job publishes the generated files.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

/** The distribution ref tracks the generated files on purpose; every other branch must not. */
const onDistributionRef = (() => {
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).stdout.trim();
  return branch === "release" || process.env.GITHUB_REF_NAME === "release";
})();

/** Generated roots: a generated file lands in one of them and must be covered by .gitignore. */
const GENERATED_ROOTS = ["dist", "schema", "agents"];

/** Hand-written files next to the generated ones: they stay tracked. */
const HAND_WRITTEN = [
  "schema/cli/commands.json",
  "schema/cli/commands.schema.json",
  "schema/cli/common/list-page.json",
];

describe.skipIf(onDistributionRef)("generated outputs", () => {
  it("are not tracked: no tracked file matches .gitignore", () => {
    // `-c -i` lists tracked files that an ignore pattern covers, which is what
    // `git add -f` of a generated file leaves behind.
    expect(git("ls-files", "-ci", "--exclude-standard").split("\n").filter(Boolean)).toEqual([]);
  });

  it("are all ignored: a build leaves no untracked file in a generated root", () => {
    // A generator that starts writing a path .gitignore does not cover shows up
    // here, once `pnpm build` has run (the test scripts run it first).
    const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...GENERATED_ROOTS)
      .split("\n")
      .filter(Boolean);
    expect(untracked).toEqual([]);
  });

  it("are written by the build: the bundle exists next to the ignored schemas", () => {
    const ignored = git("ls-files", "--others", "--ignored", "--exclude-standard", "--", "dist");
    expect(ignored).toContain("dist/bdk.mjs");
  });

  it.each(HAND_WRITTEN)("keep %s tracked", (path) => {
    expect(git("ls-files", "--", path)).toBe(path);
  });
});

describe("marketplace entry", () => {
  const marketplace = JSON.parse(
    readFileSync(join(REPO_ROOT, ".claude-plugin", "marketplace.json"), "utf8"),
  ) as { plugins: { name: string; source: unknown }[] };

  it("installs the bdk plugin from the release branch", () => {
    const entry = marketplace.plugins.find((plugin) => plugin.name === "bdk");
    expect(entry?.source).toEqual({ source: "github", repo: "broneq/bdk", ref: "release" });
  });
});

// `kernel-architecture`, Plugin launcher: the host runs `bin/bdk` as a bare
// command, so it must stay executable and keep its LF shebang on Windows checkouts.
describe("plugin launcher", () => {
  it("is tracked with the executable bit", () => {
    expect(git("ls-files", "-s", "--", "bin/bdk")).toMatch(/^100755 /);
  });

  it("keeps LF line endings in every checkout", () => {
    expect(git("check-attr", "eol", "--", "bin/bdk")).toBe("bin/bdk: eol: lf");
  });

  it("is the only file in bin/", () => {
    expect(git("ls-files", "--", "bin")).toBe("bin/bdk");
  });
});
