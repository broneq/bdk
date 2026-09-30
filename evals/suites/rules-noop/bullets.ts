// The rule bullets under test (design D-8): every `- ` line of the shipped
// rule files. A bullet's id names its file and ordinal and carries a hash of
// its text, so an edited bullet gets a new id and its old results stop
// matching (stable ids arrive in T31).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../../harness/paths.ts";

export interface Bullet {
  /** `<file>.<ordinal>.<hash>`, for example `code-quality.03.1a2b3c4d` or `languages/react.05.9f8e7d6c`. */
  readonly id: string;
  /** Repository-relative path of the rule file. */
  readonly file: string;
  /** 1-based position among the file's bullets. */
  readonly ordinal: number;
  /** The bullet without its `- ` marker. */
  readonly text: string;
}

export const RULE_DIRS = ["rules", "rules/languages"] as const;

export function bulletsOf(file: string, source: string): Bullet[] {
  const stem = file.replace(/^rules\//, "").replace(/\.md$/, "");
  return source
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line, index) => {
      const text = line.slice(2).trim();
      const hash = createHash("sha256").update(text).digest("hex").slice(0, 8);
      const ordinal = index + 1;
      return { id: `${stem}.${String(ordinal).padStart(2, "0")}.${hash}`, file, ordinal, text };
    });
}

export function readBullets(repoRoot = REPO_ROOT): Bullet[] {
  return RULE_DIRS.flatMap((dir) =>
    readdirSync(join(repoRoot, dir))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .flatMap((name) => {
        const file = `${dir}/${name}`;
        return bulletsOf(file, readFileSync(join(repoRoot, file), "utf8"));
      }),
  );
}
