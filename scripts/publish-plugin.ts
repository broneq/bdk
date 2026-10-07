// Publishes released plugins to the `release` branch (ADR-0002, design D2-D4 of
// v3-172-repo-skeleton). Usage, from the root of a clone with tags fetched:
//
//   node scripts/publish-plugin.ts [--remote <name>] [--branch <name>] <plugin>--v<version>...
//
// For each tag, one after another: build the plugin from the tag, snapshot its
// runtime files, validate the snapshot, and replace only `plugins/<plugin>/` on
// the release branch in one fast-forward commit. A failed plugin leaves the
// branch unchanged for that plugin; the others are still published, and the
// exit code is 1.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { parseArgs } from "node:util";

// Development-only paths of a plugin directory; everything else ships.
const DEV_ONLY = new Set(["src", "tests", "evals", "node_modules", "version.txt"]);
const TAG = /^(?<name>[a-z0-9][a-z0-9-]*)--v(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

interface Release {
  tag: string;
  name: string;
  version: string;
}

class PublishError extends Error {}

function run(command: string, args: string[], cwd: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    throw new PublishError(
      `\`${[command, ...args].join(" ")}\` failed in ${cwd}\n${stdout ?? ""}${stderr ?? ""}`.trim(),
    );
  }
}

function parseTag(tag: string): Release {
  const match = TAG.exec(tag);
  if (!match?.groups?.name || !match.groups.version) {
    throw new PublishError(`${tag} is not a <plugin>--v<version> tag`);
  }
  return { tag, name: match.groups.name, version: match.groups.version };
}

function isDevOnly(path: string): boolean {
  const parts = path.split(sep);
  const top = parts[0] ?? "";
  if (parts.includes("node_modules")) return true;
  if (parts.length === 1 && /^tsconfig.*\.json$/.test(top)) return true;
  return DEV_ONLY.has(top);
}

function build(source: string, plugin: string): void {
  if (existsSync(join(source, "package.json"))) {
    run("pnpm", ["install", "--frozen-lockfile"], source);
  }
  const manifest = join(source, plugin, "package.json");
  if (!existsSync(manifest)) return;
  const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { scripts?: Record<string, string> };
  if (pkg.scripts?.build) run("pnpm", ["run", "build"], join(source, plugin));
}

function checkManifest(pluginDir: string, release: Release): void {
  const path = join(pluginDir, ".claude-plugin", "plugin.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { name?: string; version?: string };
  if (manifest.name !== release.name || manifest.version !== release.version) {
    throw new PublishError(
      `${release.tag}: plugins/${release.name}/.claude-plugin/plugin.json holds ` +
        `name ${String(manifest.name)} and version ${String(manifest.version)}, ` +
        `the tag says ${release.name} ${release.version}`,
    );
  }
}

function snapshot(pluginDir: string, target: string): void {
  cpSync(pluginDir, target, {
    recursive: true,
    filter: (path) => {
      const rel = relative(pluginDir, path);
      return rel === "" || !isDevOnly(rel);
    },
  });
}

function validate(snapshotDir: string, release: Release): void {
  try {
    run("claude", ["plugin", "validate", snapshotDir, "--strict"], snapshotDir);
  } catch (error) {
    throw new PublishError(
      `${release.tag}: claude plugin validate --strict rejected the snapshot\n${(error as Error).message}`,
    );
  }
  const bin = join(snapshotDir, "bin");
  if (!existsSync(bin)) return;
  for (const entry of readdirSync(bin).sort()) {
    const path = join(bin, entry);
    const stat = statSync(path);
    if (!stat.isFile() || (stat.mode & 0o111) === 0) continue;
    const printed = run(path, ["--version"], snapshotDir);
    if (printed !== release.version) {
      throw new PublishError(
        `${release.tag}: bin/${entry} --version printed ${printed}, the release is ${release.version}`,
      );
    }
  }
}

function commitToRelease(
  repo: string,
  work: string,
  snapshotDir: string,
  release: Release,
  remote: string,
  branch: string,
): void {
  const target = join(work, `release-${release.name}`);
  const exists = run("git", ["ls-remote", "--heads", remote, branch], repo) !== "";
  if (exists) {
    run("git", ["fetch", "--quiet", remote, `refs/heads/${branch}`], repo);
    run("git", ["worktree", "add", "--quiet", "--detach", target, "FETCH_HEAD"], repo);
  } else {
    // First release: the branch starts with no history from main (design D4).
    run("git", ["worktree", "add", "--quiet", "--detach", target], repo);
    run("git", ["switch", "--quiet", "--orphan", `publish-${release.name}-${process.pid}`], target);
  }
  try {
    const pluginPath = join(target, "plugins", release.name);
    rmSync(pluginPath, { recursive: true, force: true });
    cpSync(snapshotDir, pluginPath, { recursive: true });
    run("git", ["add", "--all", "--", `plugins/${release.name}`], target);
    if (run("git", ["status", "--porcelain", "--", `plugins/${release.name}`], target) === "") {
      console.log(`${release.tag}: ${branch} already holds this snapshot, nothing to publish`);
      return;
    }
    run(
      "git",
      ["commit", "--quiet", "-m", `chore(release): ${release.name} v${release.version}`],
      target,
    );
    run("git", ["push", "--quiet", remote, `HEAD:refs/heads/${branch}`], target);
    console.log(`${release.tag}: published to ${branch}`);
  } finally {
    run("git", ["worktree", "remove", "--force", target], repo);
    if (!exists) run("git", ["branch", "-D", `publish-${release.name}-${process.pid}`], repo);
  }
}

function publish(
  repo: string,
  work: string,
  release: Release,
  remote: string,
  branch: string,
): void {
  const source = join(work, `source-${release.name}`);
  run("git", ["worktree", "add", "--quiet", "--detach", source, `refs/tags/${release.tag}`], repo);
  try {
    const pluginDir = join(source, "plugins", release.name);
    if (!existsSync(pluginDir)) {
      throw new PublishError(`${release.tag}: plugins/${release.name} does not exist at the tag`);
    }
    checkManifest(pluginDir, release);
    build(source, join("plugins", release.name));
    const snapshotDir = join(work, `snapshot-${release.name}`);
    snapshot(pluginDir, snapshotDir);
    validate(snapshotDir, release);
    commitToRelease(repo, work, snapshotDir, release, remote, branch);
  } finally {
    run("git", ["worktree", "remove", "--force", source], repo);
  }
}

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      remote: { type: "string", default: "origin" },
      branch: { type: "string", default: "release" },
    },
  });
  if (positionals.length === 0) {
    console.error(
      "usage: publish-plugin.ts [--remote <name>] [--branch <name>] <plugin>--v<version>...",
    );
    return 2;
  }
  const repo = run("git", ["rev-parse", "--show-toplevel"], process.cwd());
  let failed = 0;
  for (const tag of positionals) {
    const work = mkdtempSync(join(tmpdir(), "publish-plugin-"));
    try {
      publish(repo, work, parseTag(tag), values.remote, values.branch);
    } catch (error) {
      if (!(error instanceof PublishError)) throw error;
      console.error(error.message);
      failed += 1;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  return failed === 0 ? 0 : 1;
}

process.exitCode = main();
