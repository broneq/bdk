import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildPluginCopy } from "./plugins.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-plugins-"));
  dirs.push(dir);
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@x", ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    encoding: "utf8",
  }).trim();
}

function write(root: string, path: string, content: string): void {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
}

/** A plugin repository with a tag `v1` and one later commit on HEAD. */
function pluginRepo(): { root: string; tagged: string; head: string } {
  const root = temp();
  git(root, "init", "-q", "-b", "main");
  write(root, ".claude-plugin/plugin.json", '{"name":"bdk"}\n');
  write(root, "skills/old/SKILL.md", "old v1\n");
  write(root, "agents/implementer.md", "v2 agent\n");
  git(root, "add", "--all");
  git(root, "commit", "-q", "-m", "v1");
  git(root, "tag", "v1");
  const tagged = git(root, "rev-parse", "HEAD");
  write(root, "skills/old/SKILL.md", "old v3 era\n");
  write(root, "skills/roles/worker/SKILL.md", "role\n");
  write(root, "agents/worker.md", "adapter\n");
  git(root, "add", "--all");
  git(root, "commit", "-q", "-m", "v3");
  write(root, "skills/old/SKILL.md", "uncommitted edit\n");
  return { root, tagged, head: git(root, "rev-parse", "HEAD") };
}

describe("buildPluginCopy", () => {
  it("copies a tag's committed tree and records its commit", () => {
    const repo = pluginRepo();
    const copy = buildPluginCopy({ repoRoot: repo.root, ref: "v1", target: join(temp(), "v2") });
    expect(copy.commit).toBe(repo.tagged);
    expect(readFileSync(join(copy.dir, "skills/old/SKILL.md"), "utf8")).toBe("old v1\n");
    expect(copy.variantHash).toBeNull();
  });

  it("copies HEAD's committed tree, not the working tree", () => {
    const repo = pluginRepo();
    const copy = buildPluginCopy({ repoRoot: repo.root, ref: "HEAD", target: join(temp(), "v3") });
    expect(copy.commit).toBe(repo.head);
    expect(readFileSync(join(copy.dir, "skills/old/SKILL.md"), "utf8")).toBe("old v3 era\n");
  });

  it("keeps only the listed skills and agents, installs the variant under its name and hashes it", () => {
    const repo = pluginRepo();
    const variant = join(temp(), "SKILL.md");
    writeFileSync(variant, "---\nname: execute-thin\ndescription: name: kept\n---\nname: thin\n");
    const copy = buildPluginCopy({
      repoRoot: repo.root,
      ref: "HEAD",
      target: join(temp(), "thin"),
      keepSkills: ["roles"],
      keepAgents: ["worker"],
      variant: { name: "execute", file: variant },
    });
    expect(readdirSync(join(copy.dir, "skills")).sort()).toEqual(["execute", "roles"]);
    expect(readdirSync(join(copy.dir, "agents"))).toEqual(["worker.md"]);
    const installed = readFileSync(join(copy.dir, "skills/execute/SKILL.md"), "utf8");
    expect(installed).toBe("---\nname: execute\ndescription: name: kept\n---\nname: thin\n");
    expect(copy.variantHash).toBe(createHash("sha256").update(installed).digest("hex"));
  });

  it("removes one skill for the without cell", () => {
    const repo = pluginRepo();
    const copy = buildPluginCopy({
      repoRoot: repo.root,
      ref: "HEAD",
      target: join(temp(), "without"),
      withoutSkill: "old",
    });
    expect(existsSync(join(copy.dir, "skills/old"))).toBe(false);
    expect(existsSync(join(copy.dir, "skills/roles/worker/SKILL.md"))).toBe(true);
  });

  it("replaces a previous copy at the same target", () => {
    const repo = pluginRepo();
    const target = join(temp(), "copy");
    buildPluginCopy({ repoRoot: repo.root, ref: "HEAD", target, withoutSkill: "old" });
    const again = buildPluginCopy({ repoRoot: repo.root, ref: "HEAD", target });
    expect(existsSync(join(again.dir, "skills/old/SKILL.md"))).toBe(true);
  });
});
