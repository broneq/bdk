// The two BDK paths kept out of git (`kernel-state`, Ignored paths; design
// D-13 of T20). `git check-ignore --no-index` sees every rule wherever it
// lives; only without git does the check fall back to reading `.gitignore`.
import { join } from "node:path";

import type { Git } from "../git/index.ts";
import { KernelRefusal } from "../refusal/index.ts";
import type { Store } from "./store.ts";

export const IGNORED_PATHS = ["/.bdk/.machine/", "/.bdk/settings.local.yaml"] as const;

/** Appends to `<projectRoot>/.gitignore` each path no rule covers; returns the lines added. */
export async function ensureIgnored(
  store: Store,
  git: Git,
  projectRoot: string,
): Promise<string[]> {
  const path = join(projectRoot, ".gitignore");
  const text = store.read(path) ?? "";
  const present = new Set(text.split(/\r?\n/).map((line) => line.trim()));
  const missing: string[] = [];
  for (const line of IGNORED_PATHS) {
    if (present.has(line)) continue;
    if ((await coveredByGit(git, projectRoot, line.slice(1))) === true) continue;
    missing.push(line);
  }
  if (missing.length === 0) return [];
  const separator = text === "" || text.endsWith("\n") ? "" : "\n";
  store.write(path, `${text}${separator}${missing.map((line) => `${line}\n`).join("")}`);
  return missing;
}

/**
 * Whether `<projectRoot>/.gitignore` differs from its `HEAD` version only by
 * lines `ensureIgnored` adds, so the diff check does not count the kernel's
 * own edit as the user's work.
 */
export async function onlyKernelIgnores(
  store: Store,
  git: Git,
  projectRoot: string,
): Promise<boolean> {
  const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim());
  const current = lines(store.read(join(projectRoot, ".gitignore")) ?? "");
  const shown = await git.run(["show", "HEAD:.gitignore"], projectRoot);
  const head = shown.code === 0 ? lines(shown.stdout) : [];
  const kept = new Set(current);
  const known = new Set(head);
  const kernel: readonly string[] = IGNORED_PATHS;
  return (
    head.every((line) => kept.has(line)) &&
    current.every((line) => known.has(line) || line === "" || kernel.includes(line))
  );
}

/** true or false from git; undefined when git is missing or cannot answer. */
async function coveredByGit(
  git: Git,
  projectRoot: string,
  path: string,
): Promise<boolean | undefined> {
  try {
    const result = await git.run(["check-ignore", "--no-index", "-q", path], projectRoot);
    return result.code === 0 ? true : result.code === 1 ? false : undefined;
  } catch (error) {
    if (error instanceof KernelRefusal && error.refusal.rule === "runtime/git-missing") {
      return undefined;
    }
    throw error;
  }
}
