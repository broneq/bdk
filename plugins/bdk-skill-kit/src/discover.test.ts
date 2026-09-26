import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";
import { discover } from "./discover.ts";
import { runChecks } from "./runner.ts";
import { skill, tree } from "./test-helpers.ts";

const config = `export default { targets: [{ kind: "skills", dirs: ["skills"] }] };`;

const git = (root: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root });

/** A project inside a fresh git work tree that ignores `__pycache__/`. */
function repo(files: Record<string, string>): string {
  const root = tree({ ".gitignore": "__pycache__/\n", "skill-check.config.mjs": config, ...files });
  git(root, "init", "-q");
  return root;
}

async function files(root: string): Promise<Record<string, string[]>> {
  const { docs } = discover(root, (await loadConfig(root)).targets);
  return Object.fromEntries(docs.map((d) => [d.dir, d.files]));
}

describe("discover", () => {
  it("skips files git ignores and keeps untracked ones", async () => {
    const root = repo({
      "skills/demo/SKILL.md": skill("demo"),
      "skills/demo/scripts/a.py": "",
      "skills/demo/scripts/__pycache__/a.pyc": "",
      "skills/demo/notes.md": "",
    });
    expect(await files(root)).toEqual({ "skills/demo": ["notes.md", "scripts/a.py"] });
  });

  it("drops a committed file deleted from the work tree", async () => {
    const root = repo({ "skills/demo/SKILL.md": skill("demo"), "skills/demo/old.md": "" });
    git(root, "add", ".");
    git(root, "commit", "-qm", "init");
    rmSync(join(root, "skills/demo/old.md"));
    expect(await files(root)).toEqual({ "skills/demo": [] });
  });

  it("lists every file on disk outside a git work tree", async () => {
    const root = tree({
      "skill-check.config.mjs": config,
      "skills/demo/SKILL.md": skill("demo"),
      "skills/demo/scripts/__pycache__/a.pyc": "",
    });
    expect(await files(root)).toEqual({ "skills/demo": ["scripts/__pycache__/a.pyc"] });
  });

  it("reports no stray for a directory whose only Markdown is ignored", async () => {
    const root = repo({ "skills/cache/__pycache__/x.md": "" });
    expect(discover(root, (await loadConfig(root)).targets).strays).toEqual([]);
  });

  it("reports unused-files for untracked files only when git would track them", async () => {
    const root = repo({
      "skills/demo/SKILL.md": skill("demo", "", "Run `scripts/a.py`.\n"),
      "skills/demo/scripts/a.py": "",
      "skills/demo/scripts/__pycache__/a.pyc": "",
      "skills/demo/leftover.md": "",
    });
    const out = runChecks(await loadConfig(root), { cwd: root, paths: [] }).findings;
    expect(out.map((f) => [f.rule, f.file])).toEqual([["unused-files", "skills/demo/leftover.md"]]);
  });
});
