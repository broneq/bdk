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

  it("sets only the model line of one agent and hashes the rewritten file", () => {
    const { root } = pluginRepo();
    const adapter =
      "---\nname: worker\nmodel: sonnet\neffort: medium\n---\n\nAdapter body; model: stays.\n";
    write(root, "agents/worker.md", adapter);
    git(root, "commit", "-qam", "adapter");
    const target = join(temp(), "copy");
    const copy = buildPluginCopy({
      repoRoot: root,
      ref: "HEAD",
      target,
      agentModel: { agent: "worker", model: "opus" },
    });
    const rewritten = readFileSync(join(target, "agents/worker.md"), "utf8");
    expect(rewritten).toBe(adapter.replace("model: sonnet", "model: opus"));
    expect(copy.variantHash).toBe(createHash("sha256").update(rewritten).digest("hex"));
    expect(() =>
      buildPluginCopy({
        repoRoot: root,
        ref: "HEAD",
        target,
        agentModel: { agent: "implementer", model: "opus" },
      }),
    ).toThrow(/no frontmatter/);
  });

  it("builds the generated files from the copied commit, leaving no node_modules or .git", () => {
    const { root } = pluginRepo();
    write(
      root,
      "kernel/build.mjs",
      [
        'import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";',
        'mkdirSync("dist", { recursive: true });',
        'const linked = existsSync("node_modules/marker") && existsSync(".git") ? "linked" : "missing";',
        'writeFileSync("dist/bdk.mjs", `${linked} ${readFileSync("skills/old/SKILL.md", "utf8")}`);',
        "",
      ].join("\n"),
    );
    git(root, "add", "kernel/build.mjs");
    git(root, "commit", "-q", "-m", "build script");
    write(root, "node_modules/marker", "");
    const copy = buildPluginCopy({ repoRoot: root, ref: "HEAD", target: join(temp(), "built") });
    expect(readFileSync(join(copy.dir, "dist/bdk.mjs"), "utf8")).toBe("linked old v3 era\n");
    expect(existsSync(join(copy.dir, "node_modules"))).toBe(false);
    expect(existsSync(join(copy.dir, ".git"))).toBe(false);
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

  it("copies a plugin directory of the repository alone, without the root plugin", () => {
    const repo = pluginRepo();
    write(repo.root, "plugins/craft/.claude-plugin/plugin.json", '{"name":"craft"}\n');
    write(repo.root, "plugins/craft/skills/tdd/SKILL.md", "tdd\n");
    write(repo.root, "plugins/craft/skills/refactoring/SKILL.md", "refactoring\n");
    git(repo.root, "add", "--all");
    git(repo.root, "commit", "-q", "-m", "craft");
    const copy = buildPluginCopy({
      repoRoot: repo.root,
      ref: "HEAD",
      target: join(temp(), "without"),
      pluginDir: "plugins/craft",
      withoutSkill: "tdd",
    });
    expect(copy.commit).toBe(git(repo.root, "rev-parse", "HEAD"));
    expect(readdirSync(copy.dir).sort()).toStrictEqual([".claude-plugin", "skills"]);
    expect(readdirSync(join(copy.dir, "skills"))).toStrictEqual(["refactoring"]);
  });

  it("replaces a previous copy at the same target", () => {
    const repo = pluginRepo();
    const target = join(temp(), "copy");
    buildPluginCopy({ repoRoot: repo.root, ref: "HEAD", target, withoutSkill: "old" });
    const again = buildPluginCopy({ repoRoot: repo.root, ref: "HEAD", target });
    expect(existsSync(join(again.dir, "skills/old/SKILL.md"))).toBe(true);
  });
});

describe("generated outputs", () => {
  it("runs the ref's kernel/build.mjs in the copy with the repository's node_modules", () => {
    const { root } = pluginRepo();
    write(
      root,
      "kernel/build.mjs",
      [
        'import { mkdirSync, writeFileSync, existsSync } from "node:fs";',
        'if (!existsSync("node_modules/marker")) throw new Error("no node_modules");',
        'mkdirSync("dist", { recursive: true });',
        'writeFileSync("dist/bdk.mjs", "bundle\\n");',
        'writeFileSync("agents/worker.md", "generated adapter\\n");',
        "",
      ].join("\n"),
    );
    write(root, ".gitignore", "node_modules/\ndist/\n");
    write(root, "node_modules/marker", "");
    git(root, "add", "--all");
    git(root, "commit", "-q", "-m", "build");
    const target = join(temp(), "copy");
    buildPluginCopy({ repoRoot: root, ref: "HEAD", target, keepAgents: ["worker"] });
    expect(readFileSync(join(target, "dist/bdk.mjs"), "utf8")).toBe("bundle\n");
    expect(readFileSync(join(target, "agents/worker.md"), "utf8")).toBe("generated adapter\n");
    expect(existsSync(join(target, "node_modules"))).toBe(false);
    expect(existsSync(join(target, ".git"))).toBe(false);
  });

  it("names the build's output when it fails", () => {
    const { root } = pluginRepo();
    write(root, "kernel/build.mjs", 'console.error("esbuild broke"); process.exit(1);\n');
    write(root, "node_modules/marker", "");
    write(root, ".gitignore", "node_modules/\n");
    git(root, "add", "--all");
    git(root, "commit", "-q", "-m", "broken build");
    const target = join(temp(), "copy");
    expect(() => buildPluginCopy({ repoRoot: root, ref: "HEAD", target })).toThrow(/esbuild broke/);
    expect(existsSync(join(target, "node_modules"))).toBe(false);
  });
});
