import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CliError } from "../../cli/index.ts";
import { GitError, git } from "../index.ts";

// The git boundary against a real temporary repository.

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-git-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("git", () => {
  it("returns stdout of a command run in the directory", () => {
    writeFileSync(join(root, "ząb ü.txt"), "x");
    git(root, ["add", "."]);
    expect(git(root, ["diff", "--cached", "--name-only"])).toBe("ząb ü.txt\n");
  });

  it("throws GitError with stderr and exit status when git fails", () => {
    let caught: unknown;
    try {
      git(root, ["rev-parse", "--verify", "no-such-ref^{commit}"]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GitError);
    expect((caught as GitError).status).toBe(128);
    expect((caught as GitError).stderr).toMatch(/fatal/);
  });

  it("reports env/git-missing when the executable is missing", () => {
    let caught: unknown;
    try {
      git(root, ["status"], "bdk-no-such-git-binary");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe("env/git-missing");
  });
});
