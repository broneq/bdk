import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { LoadedTarget } from "./config.ts";
import { parseDocument } from "./document.ts";
import type { Document } from "./index.ts";

export interface Discovery {
  docs: Document[];
  /** Skill directories that hold Markdown but no skill file in any letter case. */
  strays: string[];
}

const toPosix = (path: string) => path.split(sep).join("/");

export function discover(root: string, targets: LoadedTarget[]): Discovery {
  const docs: Document[] = [];
  const strays: string[] = [];
  for (const target of targets) {
    for (const dir of target.dirs) {
      const base = join(root, dir);
      if (target.kind === "agents") {
        for (const entry of sorted(base)) {
          if (entry.isFile() && entry.name.endsWith(".md")) {
            const file = join(base, entry.name);
            docs.push(read(root, target, file, base, []));
          }
        }
        continue;
      }
      const list = lister(base);
      for (const entry of sorted(base)) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const skillDir = join(base, entry.name);
        const names = sorted(skillDir);
        const skillFile = names.find((e) => e.isFile() && e.name.toLowerCase() === "skill.md");
        if (skillFile) {
          const files = list(entry.name).filter((f) => f !== skillFile.name);
          docs.push(read(root, target, join(skillDir, skillFile.name), skillDir, files));
        } else if (list(entry.name).some((f) => f.endsWith(".md"))) {
          strays.push(toPosix(relative(root, skillDir)));
        }
      }
    }
  }
  return { docs, strays };
}

function read(
  root: string,
  target: LoadedTarget,
  file: string,
  dir: string,
  files: string[],
): Document {
  return parseDocument({
    kind: target.kind,
    target: { kind: target.kind, dirs: target.dirs, profile: target.profile, name: target.name },
    path: toPosix(relative(root, file)),
    dir: toPosix(relative(root, dir)),
    text: readFileSync(file, "utf8"),
    files,
  });
}

function sorted(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Lists the files of a skill directory under `base`, relative to it, POSIX,
 * dotfiles skipped. Inside a git work tree only files git tracks or would
 * track count, so ignored build and cache output never reaches the rules.
 * Outside one, every file on disk counts.
 */
function lister(base: string): (name: string) => string[] {
  const files = gitFiles(base);
  if (!files) return (name) => walk(join(base, name));
  return (name) =>
    files.filter((f) => f.startsWith(`${name}/`)).map((f) => f.slice(name.length + 1));
}

/** Files git tracks or would track under `dir`, or null outside a work tree. */
function gitFiles(dir: string): string[] | null {
  const run = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."],
    { cwd: dir, encoding: "utf8" },
  );
  if (run.error || run.status !== 0) return null;
  return [...new Set(run.stdout.split("\0"))]
    .filter((f) => f && !f.split("/").some((part) => part.startsWith(".")) && isFile(join(dir, f)))
    .sort((a, b) => a.localeCompare(b));
}

/** True for a regular file; a deleted but still indexed path is not one. */
function isFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** Every file under `dir`, relative to it, POSIX, dotfiles skipped. */
function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of sorted(dir)) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}
