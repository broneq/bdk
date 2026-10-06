// The user-facing files of the repository, shared by the content tests that
// keep removed skill and agent names out. The migration page maps each removed
// name to its replacement, so it is the one user-facing file left out.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./run.ts";

const ROOTS = ["skills", "agents", "rules", "fragments", ".claude", "docs/guide"];
const SINGLE = ["README.md", "STARTUP_INSTRUCTIONS.md", "CONTRIBUTING.md", "CLAUDE.md"];

/** The one page that names v2 skills, agents, keys and paths, repository-relative. */
export const MIGRATION_PAGE_PATH = "docs/guide/getting-started/migration-from-v2.md";

/**
 * Absolute paths of every user-facing file git sees but the migration page,
 * so ignored ones such as `.claude/worktrees/` (other checkouts) stay out.
 */
export function userFacingFiles(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...ROOTS, ...SINGLE],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (path) => path !== "" && path !== MIGRATION_PAGE_PATH && existsSync(join(REPO_ROOT, path)),
    )
    .map((path) => join(REPO_ROOT, path));
}
