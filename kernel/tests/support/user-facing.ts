// The user-facing files of the repository and their "Removed skills"
// sections, shared by the content tests that keep removed skill names out.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./run.ts";

const ROOTS = ["skills", "agents", "rules", "fragments", ".claude", "docs/guide"];
const SINGLE = ["README.md", "STARTUP_INSTRUCTIONS.md", "CONTRIBUTING.md", "CLAUDE.md"];

/**
 * Absolute paths of every user-facing file git sees, so ignored ones such as
 * `.claude/worktrees/` (other checkouts) stay out.
 */
export function userFacingFiles(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...ROOTS, ...SINGLE],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
    .split("\0")
    .filter((path) => path !== "" && existsSync(join(REPO_ROOT, path)))
    .map((path) => join(REPO_ROOT, path));
}

/**
 * The text without its "Removed skills" section, which maps each removed
 * skill to its replacement (`README.md`, `docs/guide/reference/skills.md`).
 */
export function withoutRemovedSection(text: string): string {
  const heading = /^(#+) Removed skills$/m.exec(text);
  if (heading?.[1] === undefined) return text;
  const rest = text.slice(heading.index + heading[0].length);
  const next = new RegExp(`^#{1,${String(heading[1].length)}} `, "m").exec(rest);
  return text.slice(0, heading.index) + (next === null ? "" : rest.slice(next.index));
}
