// Plugin copies (design D-5, D-9): the committed tree of a ref, exported with
// `git archive`, trimmed to the arm's skills and agents, with an optional
// skill variant added, one skill removed, or one agent's model changed. The host scans the default
// `skills/` directory in addition to the manifest's `skills` array
// (evals/README.md, Provider facts), so trimming is what keeps other skills
// out of a session. The generated files (the bundle, the schemas and the
// agent adapters) are not committed (T48), so the copy builds them from its
// own tree, as the release job does.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

export interface PluginCopySpec {
  readonly repoRoot: string;
  /** A tag, a commit or `HEAD`; the copy holds its committed tree. */
  readonly ref: string;
  readonly target: string;
  /** Top-level entries of `skills/` to keep; all when absent. The variant is always kept. */
  readonly keepSkills?: readonly string[];
  /** Agent names (file names without `.md`) to keep; all when absent. */
  readonly keepAgents?: readonly string[];
  /**
   * A SKILL.md installed as `skills/<name>/SKILL.md` with its frontmatter
   * `name` set to `<name>`: the arms are stored under distinct names
   * (`execute-thin`), because skill names are unique across the repository.
   */
  readonly variant?: { readonly name: string; readonly file: string };
  /** A skill directory under `skills/` removed, for a with / without comparison. */
  readonly withoutSkill?: string;
  /**
   * The `model` line of `agents/<agent>.md` set to `model`, nothing else of the
   * file changed: the cells of `review-models` differ only in it (T42 D10).
   */
  readonly agentModel?: { readonly agent: string; readonly model: string };
}

export interface PluginCopy {
  readonly dir: string;
  /** The commit the ref resolved to. */
  readonly commit: string;
  /** sha256 of the installed variant SKILL.md or the rewritten agent, or null without either. */
  readonly variantHash: string | null;
}

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", stdio: "pipe" }).trim();
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The agent file with the `model` line of its frontmatter set to `model`. */
function withModel(text: string, model: string): string {
  const end = text.indexOf("\n---", 4);
  if (!text.startsWith("---\n") || end === -1) throw new Error("agent file has no frontmatter");
  const frontmatter = text.slice(0, end);
  if (!/^model:.*$/m.test(frontmatter)) throw new Error("agent frontmatter has no model line");
  return frontmatter.replace(/^model:.*$/m, `model: ${model}`) + text.slice(end);
}

/** The SKILL.md text with the `name` field of its frontmatter set to `name`. */
function renamed(text: string, name: string): string {
  const end = text.indexOf("\n---", 4);
  if (!text.startsWith("---\n") || end === -1)
    throw new Error("variant SKILL.md has no frontmatter");
  const frontmatter = text.slice(0, end).replace(/^name:.*$/m, `name: ${name}`);
  return frontmatter + text.slice(end);
}

/**
 * Runs the copy's own `kernel/build.mjs` in the copy, with the repository's
 * `node_modules` linked in and a throwaway git repository around it for the
 * build (`bdk export agents` runs only inside one), both removed after it. So
 * the bundle, schemas and adapters match the copied commit, not the working
 * tree. A tree without the build script has nothing to generate.
 */
function buildGenerated(repoRoot: string, target: string): void {
  if (!existsSync(join(target, "kernel", "build.mjs"))) return;
  const modules = join(target, "node_modules");
  symlinkSync(join(repoRoot, "node_modules"), modules, "dir");
  try {
    git(target, "init", "-q");
    execFileSync(process.execPath, ["kernel/build.mjs"], { cwd: target, stdio: "pipe" });
  } finally {
    rmSync(modules, { force: true });
    rmSync(join(target, ".git"), { recursive: true, force: true });
  }
}

function keepOnly(dir: string, keep: readonly string[], nameOf: (entry: string) => string): void {
  for (const entry of readdirSync(dir)) {
    if (!keep.includes(nameOf(entry))) rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

export function buildPluginCopy(spec: PluginCopySpec): PluginCopy {
  const commit = git(spec.repoRoot, "rev-parse", `${spec.ref}^{commit}`);
  rmSync(spec.target, { recursive: true, force: true });
  mkdirSync(spec.target, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), "bdk-evals-archive-"));
  try {
    const archive = join(scratch, "plugin.tar");
    git(spec.repoRoot, "archive", "--format=tar", "--output", archive, commit);
    execFileSync("tar", ["-xf", archive, "-C", spec.target]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  buildGenerated(spec.repoRoot, spec.target);

  const skills = join(spec.target, "skills");
  if (spec.keepSkills !== undefined) keepOnly(skills, spec.keepSkills, (entry) => entry);
  if (spec.keepAgents !== undefined) {
    keepOnly(join(spec.target, "agents"), spec.keepAgents, (entry) => basename(entry, ".md"));
  }
  if (spec.withoutSkill !== undefined) {
    rmSync(join(skills, spec.withoutSkill), { recursive: true, force: true });
  }
  let variantHash: string | null = null;
  if (spec.variant !== undefined) {
    const installed = join(skills, spec.variant.name, "SKILL.md");
    mkdirSync(dirname(installed), { recursive: true });
    writeFileSync(installed, renamed(readFileSync(spec.variant.file, "utf8"), spec.variant.name));
    variantHash = sha256File(installed);
  }
  if (spec.agentModel !== undefined) {
    const agent = join(spec.target, "agents", `${spec.agentModel.agent}.md`);
    writeFileSync(agent, withModel(readFileSync(agent, "utf8"), spec.agentModel.model));
    variantHash = sha256File(agent);
  }
  return { dir: spec.target, commit, variantHash };
}
