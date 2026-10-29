import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// The repository process runs without OpenSpec (ADR-0005): no root `openspec/` directory, no
// `.claude/skills/openspec-*` skill and no `.claude/commands/opsx` command set. The bdk plugin's
// own OpenSpec schema under plugins/bdk/ is the product, not the repository process, and is not
// checked here. The word OpenSpec itself may appear anywhere.

const root = join(import.meta.dirname, "..");

function leftovers(dir: string): string[] {
  const found = ["openspec", ".claude/commands/opsx"].filter((path) => existsSync(join(dir, path)));
  const skills = join(dir, ".claude/skills");
  const openspecSkills = existsSync(skills)
    ? readdirSync(skills)
        .filter((name) => name.startsWith("openspec-"))
        .map((name) => `.claude/skills/${name}`)
    : [];
  return [...found, ...openspecSkills];
}

let scratch: string | undefined;

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

describe("OpenSpec leftover check", () => {
  it("finds a root openspec directory, an openspec skill and the opsx commands", () => {
    scratch = mkdtempSync(join(tmpdir(), "bdk-no-openspec-"));
    for (const path of ["openspec", ".claude/skills/openspec-propose", ".claude/commands/opsx"]) {
      mkdirSync(join(scratch, path), { recursive: true });
    }
    mkdirSync(join(scratch, ".claude/skills/commit"), { recursive: true });
    expect(leftovers(scratch)).toEqual([
      "openspec",
      ".claude/commands/opsx",
      ".claude/skills/openspec-propose",
    ]);
  });

  it("passes a repository without them", () => {
    scratch = mkdtempSync(join(tmpdir(), "bdk-no-openspec-"));
    expect(leftovers(scratch)).toEqual([]);
  });
});

describe("this repository", () => {
  it("holds no OpenSpec process files", () => {
    expect(leftovers(root)).toEqual([]);
  });
});
