// The rule bullets under test (design D-8): the rules of the shipped pack
// that T40 measured. A bullet keeps its T40 id (`<file>.<ordinal>.<hash>` of
// the v2 rule files), mapped to its pack id through the migration report, so
// the committed result rows still match; a pack rule without a row (the plan
// rules) was never measured and is no bullet.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../../harness/paths.ts";

export interface Bullet {
  /** The T40 id, for example `code-quality.03.1a2b3c4d` or `languages/react.05.9f8e7d6c`. */
  readonly id: string;
  /** The pack id the migration gave it, for example `BDK-CQ-3`. */
  readonly rule: string;
  /** Repository-relative path of the rule file. */
  readonly file: string;
  /** The rule text: the file's body. */
  readonly text: string;
}

export const MIGRATION_REPORT = "docs/V3-RULES-MIGRATION.md";

/** A table row of the report whose first cell is a T40 id; the table is column-aligned. */
const T40_ROW = /^\| `([a-z/-]+\.[0-9]{2}\.[0-9a-f]{8})` +\|/;

/** T40 id to pack id, from the `kept as <id>` rows of the migration report. */
export function keptMapping(report: string): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const line of report.split("\n")) {
    const id = T40_ROW.exec(line)?.[1];
    const kept = /\| kept as (BDK-[A-Z]+-[0-9]+) +\|/.exec(line)?.[1];
    if (id !== undefined && kept !== undefined) mapping.set(id, kept);
  }
  return mapping;
}

/** The T40 ids of every row of the migration report, kept or removed. */
export function measuredIds(report: string): Set<string> {
  return new Set(
    report.split("\n").flatMap((line) => {
      const id = T40_ROW.exec(line)?.[1];
      return id === undefined ? [] : [id];
    }),
  );
}

export interface PackRule {
  /** The pack directory under `rules/`, for example `code-quality` or `languages/react`. */
  readonly dir: string;
  readonly id: string;
  readonly file: string;
  readonly text: string;
}

/** Every rule of the pack in directory then number order, the README left out. */
export function readPack(repoRoot = REPO_ROOT, dir = ""): PackRule[] {
  const root = join(repoRoot, "rules", dir);
  return readdirSync(root, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .flatMap((entry): PackRule[] => {
      const inner = dir === "" ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) return readPack(repoRoot, inner);
      if (dir === "" || !entry.name.endsWith(".md")) return [];
      const source = readFileSync(join(root, entry.name), "utf8");
      const match = /^---\n[\s\S]*?\n---\n/.exec(source);
      return [
        {
          dir,
          id: entry.name.slice(0, -".md".length),
          file: `rules/${inner}`,
          text: (match === null ? source : source.slice(match[0].length)).trim(),
        },
      ];
    });
}

export function readBullets(repoRoot = REPO_ROOT): Bullet[] {
  const mapping = keptMapping(readFileSync(join(repoRoot, MIGRATION_REPORT), "utf8"));
  const t40 = new Map([...mapping].map(([id, rule]) => [rule, id]));
  return readPack(repoRoot).flatMap((rule) => {
    const id = t40.get(rule.id);
    return id === undefined ? [] : [{ id, rule: rule.id, file: rule.file, text: rule.text }];
  });
}
