// The M2 seeded patches (design D-8): `patches/*.patch` against the stripped
// fixture base, and `violations.yaml`, which maps each seeded violation to the
// rule bullet it breaks and the added line that breaks it. Three patches are
// clean controls with no violations. Bullets no TypeScript/React diff of this
// fixture can break are listed as not seedable, with the reason.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export const PATCHES_DIR = fileURLToPath(new URL("./patches", import.meta.url));
export const VIOLATIONS_FILE = fileURLToPath(new URL("./violations.yaml", import.meta.url));

export interface Violation {
  readonly bullet: string;
  readonly file: string;
  /** The line in the patched file, always one the patch adds. */
  readonly line: number;
  readonly what: string;
}

export interface SeededPatch {
  readonly patch: string;
  readonly violations: readonly Violation[];
}

export interface NotSeedable {
  readonly bullet: string;
  readonly reason: string;
}

export interface Violations {
  readonly patches: readonly SeededPatch[];
  readonly notSeedable: readonly NotSeedable[];
}

export function readViolations(file = VIOLATIONS_FILE): Violations {
  const raw = parse(readFileSync(file, "utf8")) as {
    patches: SeededPatch[];
    "not-seedable": NotSeedable[];
  };
  return { patches: raw.patches, notSeedable: raw["not-seedable"] };
}

/** The patch names in `PATCHES_DIR`, without the `.patch` extension, sorted. */
export function patchNames(dir = PATCHES_DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".patch"))
    .map((name) => name.slice(0, -".patch".length))
    .sort();
}

export function readPatch(name: string, dir = PATCHES_DIR): string {
  return readFileSync(join(dir, `${name}.patch`), "utf8");
}

/** Per changed file, the lines a unified diff adds, keyed by their line number in the new file. */
export function addedLines(patch: string): Map<string, Map<number, string>> {
  const files = new Map<string, Map<number, string>>();
  let current: Map<number, string> | null = null;
  let line = 0;
  for (const text of patch.split("\n")) {
    if (text.startsWith("+++ ")) {
      const path = text.slice(4);
      current = path === "/dev/null" ? null : new Map();
      if (current !== null) files.set(path.replace(/^b\//, ""), current);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk !== null) {
      line = Number(hunk[1]);
      continue;
    }
    if (current === null || text.startsWith("--- ")) continue;
    if (text.startsWith("+")) {
      current.set(line, text.slice(1));
      line += 1;
    } else if (text.startsWith(" ")) {
      line += 1;
    }
  }
  return files;
}

/** Check that a patch applies to the fixture base; throws with git's message when it does not. */
export function checkPatch(baseDir: string, name: string, dir = PATCHES_DIR): void {
  execFileSync("git", ["apply", "--check", join(dir, `${name}.patch`)], {
    cwd: baseDir,
    stdio: "pipe",
  });
}

/** The metric key of one seeded violation in an M2 result row. */
export function violationKey(violation: Pick<Violation, "bullet" | "file" | "line">): string {
  return `${violation.bullet}@${violation.file}:${String(violation.line)}`;
}
