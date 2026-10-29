import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import config from "../skill-check.config.ts";

// Every plugin's skills and agents pass skill-check in strict mode, with the root
// skill-check.config.ts (CONTRIBUTING.md, "Checks"). The kit's vitest.setup.ts
// builds the CLI before any test runs.

const root = join(import.meta.dirname, "..");
const bin = join(root, "plugins/bdk-skill-kit/dist/skill-check.mjs");

it("checks the skills and agents of every plugin", () => {
  const expected = readdirSync(join(root, "plugins"))
    .flatMap((plugin) => ["skills", "agents"].map((kind) => `plugins/${plugin}/${kind}`))
    .filter((dir) => existsSync(join(root, dir)))
    .sort();
  expect(config.targets.flatMap((target) => target.dirs).sort()).toEqual(expected);
});

it("finds no error or warning in any plugin's skills and agents", () => {
  const run = spawnSync(process.execPath, [bin, "--strict"], { cwd: root, encoding: "utf8" });
  expect(run.stdout + run.stderr).toMatch(/^No findings in \d+ files\.$/m);
  expect(run.status).toBe(0);
});
