// The fixture repository (design D-3): fetched once at its pinned commit,
// stripped of its own agent configuration, committed as the base on
// `feat/eval` (with `main` at the same commit), and copied fresh into a run's working directory before every
// run. Nothing of it is committed to BDK: the repository has no licence.
import { execFileSync } from "node:child_process";
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface FixturePin {
  readonly repository: string;
  readonly commit: string;
}

/** The fixture's own instructions and agent configuration, removed so they cannot compete with the skill under test. */
const STRIPPED = [".claude", ".agents", "CLAUDE.md", "AGENTS.md"] as const;

const BASE_BRANCH = "feat/eval";
const MARKER = ".bdk-eval-base";

export class FixtureMismatch extends Error {
  constructor(pinned: string, fetched: string) {
    super(`fixture commit mismatch: pinned ${pinned}, fetched ${fetched}`);
    this.name = "FixtureMismatch";
  }
}

// The harness's own git calls ignore the user's global and system config
// (signing, hooks paths, aliases); the identity lives in the fixture's local
// config, so the sessions' commits in every copy use it too.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", stdio: "pipe" }).trim();
}

export interface PrepareOptions {
  /** Installs the fixture's dependencies into the base once (the suite passes `npm ci`). */
  readonly install?: (dir: string) => void;
}

/** The prepared base directory for the pin, built on first use and reused afterwards. */
export function prepareFixture(
  pin: FixturePin,
  cacheDir: string,
  options: PrepareOptions = {},
): string {
  const base = join(cacheDir, "fixture", pin.commit.slice(0, 12));
  const marker = join(base, MARKER);
  if (existsSync(marker) && readFileSync(marker, "utf8").trim() === pin.commit) return base;

  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  git(base, "init", "--quiet", "--initial-branch", "upstream");
  git(base, "fetch", "--quiet", "--depth", "1", pin.repository, pin.commit);
  git(base, "checkout", "--quiet", "FETCH_HEAD");
  const fetched = git(base, "rev-parse", "HEAD");
  if (fetched !== pin.commit) throw new FixtureMismatch(pin.commit, fetched);

  for (const path of STRIPPED) rmSync(join(base, path), { recursive: true, force: true });
  git(base, "config", "user.name", "BDK Eval");
  git(base, "config", "user.email", "eval@bdk.invalid");
  git(base, "config", "commit.gpgsign", "false");
  git(base, "checkout", "--quiet", "-b", BASE_BRANCH);
  git(base, "add", "--all");
  git(
    base,
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    `eval base: ${pin.repository}@${pin.commit} without agent instructions`,
  );
  // `main` marks the base too: the v2 executor reviews from `merge-base HEAD main`.
  git(base, "branch", "main");
  writeFileSync(join(base, ".git/info/exclude"), `${MARKER}\n`, { flag: "a" });

  options.install?.(base);
  writeFileSync(marker, `${pin.commit}\n`);
  return base;
}

/**
 * An empty repository on `main` with one commit, at `dir`: a session without
 * the fixture still runs in a git tree.
 */
export function emptyBase(dir: string): string {
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "--quiet", "--initial-branch", "main");
  git(dir, "config", "user.name", "BDK Eval");
  git(dir, "config", "user.email", "eval@bdk.invalid");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "commit", "--quiet", "--allow-empty", "-m", "empty eval base");
  return dir;
}

/** Replace `target` with a copy of `base`, cloned copy-on-write where the filesystem allows it. */
export function freshCopy(base: string, target: string): void {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(base, target, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
  });
}

/**
 * `npm ci` in the fixture base, the suites' install step. `pnpm eval` runs
 * under pnpm, which exports its own `npm_config_*` settings; npm does not know
 * them and warns, so the fixture's install gets the environment without them.
 */
export function npmCi(dir: string, env: NodeJS.ProcessEnv = process.env): void {
  const clean = Object.fromEntries(
    Object.entries(env).filter(([key]) => !key.toLowerCase().startsWith("npm_config_")),
  );
  execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {
    cwd: dir,
    env: clean,
    stdio: "inherit",
  });
}
