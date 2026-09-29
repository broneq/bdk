import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { needsInstall } from "./tools.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function evalsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-tools-"));
  dirs.push(dir);
  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return dir;
}

describe("needsInstall", () => {
  it("is true without node_modules", () => {
    expect(needsInstall(evalsDir())).toBe(true);
  });

  it("is false when the install is newer than the lockfile, true when older", () => {
    const dir = evalsDir();
    mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
    writeFileSync(join(dir, "node_modules/.bin/promptfoo"), "");
    writeFileSync(join(dir, "node_modules/.modules.yaml"), "");
    const lock = join(dir, "pnpm-lock.yaml");
    const modules = join(dir, "node_modules/.modules.yaml");
    utimesSync(lock, new Date(1000), new Date(1000));
    utimesSync(modules, new Date(2000), new Date(2000));
    expect(needsInstall(dir)).toBe(false);
    utimesSync(lock, new Date(3000), new Date(3000));
    expect(needsInstall(dir)).toBe(true);
  });
});
