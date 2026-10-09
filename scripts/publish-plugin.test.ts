import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Runs scripts/publish-plugin.ts as the release workflow does: from a clone of
// the repository, with tags pushed to a remote, against that remote's `release`.

const script = join(import.meta.dirname, "publish-plugin.ts");

let base: string;
let repo: string;
let remote: string;
let env: NodeJS.ProcessEnv;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
}

function write(path: string, content: string, executable = false): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (executable) chmodSync(path, 0o755);
}

interface PluginOptions {
  version: string;
  author?: boolean;
  // Version the built CLI prints; defaults to the manifest version.
  cliVersion?: string;
  skill?: string;
}

// A plugin as ADR-0002 lays it out: manifest, a skill, a `bin/` launcher, CLI
// source built to `dist/`, tests, evals, and the files release-please writes.
function writePlugin(name: string, options: PluginOptions): void {
  const dir = join(repo, "plugins", name);
  rmSync(dir, { recursive: true, force: true });
  const manifest: Record<string, unknown> = {
    name,
    version: options.version,
    description: `Fixture plugin ${name} for the publish tests`,
  };
  if (options.author !== false) manifest.author = { name: "BDK tests" };
  write(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");
  const skill = options.skill ?? "hello";
  write(
    join(dir, "skills", skill, "SKILL.md"),
    `---\nname: ${skill}\ndescription: Says ${skill} from the ${name} fixture plugin. Use in publish tests only.\n---\n\nSay ${skill}.\n`,
  );
  write(
    join(dir, "bin", name),
    `#!/bin/sh\nexec node "$(dirname "$(realpath "$0")")/../dist/${name}.mjs" "$@"\n`,
    true,
  );
  write(
    join(dir, "package.json"),
    JSON.stringify({ name, private: true, scripts: { build: "node src/build.mjs" } }) + "\n",
  );
  write(
    join(dir, "src", "build.mjs"),
    `import { mkdirSync, writeFileSync } from "node:fs";\n` +
      `mkdirSync("dist", { recursive: true });\n` +
      `writeFileSync("dist/${name}.mjs", ${JSON.stringify(`console.log(${JSON.stringify(options.cliVersion ?? options.version)});\n`)});\n`,
  );
  write(join(dir, "tests", "cli.test.ts"), "// fixture test\n");
  write(join(dir, "evals", "case.json"), "{}\n");
  write(join(dir, "tsconfig.json"), "{}\n");
  write(join(dir, "CHANGELOG.md"), `# ${name}\n`);
}

function release(name: string, options: PluginOptions): string {
  writePlugin(name, options);
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", `chore(main): release ${name} ${options.version}`);
  const tag = `${name}--v${options.version}`;
  git(repo, "tag", tag);
  git(repo, "push", "--quiet", "origin", "HEAD:refs/heads/main", tag);
  return tag;
}

function publish(...tags: string[]): { status: number | null; output: string } {
  const result = spawnSync("node", [script, ...tags], { cwd: repo, env, encoding: "utf8" });
  return { status: result.status, output: result.stdout + result.stderr };
}

function releaseHead(): string {
  return git(remote, "rev-parse", "--verify", "--quiet", "refs/heads/release");
}

function releaseFiles(): string[] {
  return git(remote, "ls-tree", "-r", "--name-only", "release").split("\n").sort();
}

function treeOf(path: string, ref = "release"): string {
  return git(remote, "rev-parse", `${ref}:${path}`);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "publish-plugin-test-"));
  repo = join(base, "repo");
  remote = join(base, "remote.git");
  const gitconfig = join(base, "gitconfig");
  writeFileSync(
    gitconfig,
    "[user]\n\tname = BDK tests\n\temail = tests@example.com\n" +
      "[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n" +
      "[init]\n\tdefaultBranch = main\n[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n",
  );
  // The fixture plugin has no lockfile; pnpm's dependency check before `pnpm run` would install
  // and write one. `pnpm test` turns the check off, a bare `vitest` run does not.
  env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: gitconfig,
    GIT_CONFIG_NOSYSTEM: "1",
    pnpm_config_verify_deps_before_run: "false",
  };
  git(base, "init", "--quiet", "--bare", remote);
  git(base, "init", "--quiet", repo);
  git(repo, "remote", "add", "origin", remote);
  write(join(repo, "README.md"), "main history, never on release\n");
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", "chore: initial commit");
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("publish-plugin", () => {
  it("creates release as an orphan branch holding only the plugin's runtime files", () => {
    const tag = release("demo", { version: "1.0.0" });

    const result = publish(tag);

    expect(result.status, result.output).toBe(0);
    expect(git(remote, "rev-list", "--count", "release")).toBe("1");
    expect(releaseFiles()).toEqual([
      "plugins/demo/.claude-plugin/plugin.json",
      "plugins/demo/CHANGELOG.md",
      "plugins/demo/bin/demo",
      "plugins/demo/dist/demo.mjs",
      "plugins/demo/package.json",
      "plugins/demo/skills/hello/SKILL.md",
    ]);
    expect(git(remote, "log", "-1", "--format=%s", "release")).toBe("chore(release): demo v1.0.0");
  });

  it("keeps the executable bit of bin/ launchers", () => {
    publish(release("demo", { version: "1.0.0" }));

    expect(git(remote, "ls-tree", "release", "plugins/demo/bin/demo")).toMatch(/^100755 /);
  });

  it("leaves other plugins byte-identical and builds on the previous head", () => {
    expect(publish(release("demo", { version: "1.0.0" })).status).toBe(0);
    const demoTree = treeOf("plugins/demo");
    const previousHead = releaseHead();

    const result = publish(release("other", { version: "0.1.0" }));

    expect(result.status, result.output).toBe(0);
    expect(treeOf("plugins/demo")).toBe(demoTree);
    expect(git(remote, "rev-parse", "release^")).toBe(previousHead);
    expect(git(remote, "diff", "--name-only", "release^", "release").split("\n")).toSatisfy(
      (paths: string[]) => paths.every((path) => path.startsWith("plugins/other/")),
    );
  });

  it("removes files that the new release no longer ships", () => {
    expect(publish(release("demo", { version: "1.0.0", skill: "hello" })).status).toBe(0);

    const result = publish(release("demo", { version: "1.1.0", skill: "goodbye" }));

    expect(result.status, result.output).toBe(0);
    expect(releaseFiles()).toContain("plugins/demo/skills/goodbye/SKILL.md");
    expect(releaseFiles()).not.toContain("plugins/demo/skills/hello/SKILL.md");
  });

  it("publishes several plugins of one run one after another, one commit each", () => {
    const demo = release("demo", { version: "1.0.0" });
    const other = release("other", { version: "0.1.0" });

    const result = publish(demo, other);

    expect(result.status, result.output).toBe(0);
    expect(git(remote, "log", "--format=%s", "release").split("\n")).toEqual([
      "chore(release): other v0.1.0",
      "chore(release): demo v1.0.0",
    ]);
  });

  it("makes no commit when the snapshot equals what release holds", () => {
    const tag = release("demo", { version: "1.0.0" });
    expect(publish(tag).status).toBe(0);
    const head = releaseHead();

    const result = publish(tag);

    expect(result.status, result.output).toBe(0);
    expect(releaseHead()).toBe(head);
  });

  it("rejects a manifest version that differs from the tag", () => {
    publish(release("other", { version: "0.1.0" }));
    const head = releaseHead();
    writePlugin("demo", { version: "1.0.0" });
    git(repo, "add", "-A");
    git(repo, "commit", "--quiet", "-m", "feat: demo");
    git(repo, "tag", "demo--v2.0.0");
    git(repo, "push", "--quiet", "origin", "HEAD:refs/heads/main", "demo--v2.0.0");

    const result = publish("demo--v2.0.0");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("demo");
    expect(result.output).toContain("1.0.0");
    expect(result.output).toContain("2.0.0");
    expect(releaseHead()).toBe(head);
  });

  it("rejects a CLI whose --version differs from the release", () => {
    publish(release("other", { version: "0.1.0" }));
    const head = releaseHead();

    const result = publish(release("demo", { version: "1.0.0", cliVersion: "0.9.9" }));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("bin/demo");
    expect(result.output).toContain("0.9.9");
    expect(releaseHead()).toBe(head);
  });

  it("rejects a snapshot that fails strict plugin validation", () => {
    publish(release("other", { version: "0.1.0" }));
    const head = releaseHead();

    const result = publish(release("demo", { version: "1.0.0", author: false }));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("claude plugin validate");
    expect(releaseHead()).toBe(head);
  });

  it("still publishes the other plugins of a run when one fails", () => {
    const broken = release("demo", { version: "1.0.0", author: false });
    const other = release("other", { version: "0.1.0" });

    const result = publish(broken, other);

    expect(result.status).not.toBe(0);
    expect(releaseFiles().every((path) => path.startsWith("plugins/other/"))).toBe(true);
  });

  it("rejects an argument that is not a <plugin>--v<version> tag", () => {
    const result = publish("v1.0.0");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("v1.0.0");
  });
});
