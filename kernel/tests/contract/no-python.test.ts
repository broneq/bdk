// `plugin-tooling`, Repository without Python: the plugin runs no `python3`,
// git tracks no Python file or Python project file, and no package script
// runs a Python tool. Historic records may still name Python as text.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

function tracked(...paths: string[]): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", ...paths], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

const PYTHON_FILE = /(\.py$|(^|\/)__pycache__\/|(^|\/)pyproject\.toml$|(^|\/)uv\.lock$)/;
const PYTHON_TOOL = /(^|[\s;&|(])(uv|uvx|pytest|ruff)(\s|$)/;

describe("repository without Python", () => {
  it("tracks no Python file, __pycache__, pyproject.toml or uv.lock", () => {
    expect(tracked().filter((path) => PYTHON_FILE.test(path))).toStrictEqual([]);
  });

  it("runs no python3 from hooks/ or skills/", () => {
    const callers = tracked("hooks", "skills").filter((path) =>
      readFileSync(join(REPO_ROOT, path), "utf8").includes("python3"),
    );
    expect(callers).toStrictEqual([]);
  });

  it("has no package script that runs uv, uvx, pytest or ruff", () => {
    const { scripts } = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const runners = Object.entries(scripts)
      .filter(([, command]) => PYTHON_TOOL.test(command))
      .map(([name]) => name);
    expect(runners).toStrictEqual([]);
  });

  it.each(["uv run pytest", "pnpm x && ruff check", "uvx tool"])("recognises %s", (command) => {
    expect(PYTHON_TOOL.test(command)).toBe(true);
  });

  it.each(["pnpm build", "vitest run --project uvx-free", "eslint kernel"])(
    "does not flag %s",
    (command) => {
      expect(PYTHON_TOOL.test(command)).toBe(false);
    },
  );
});
