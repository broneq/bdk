// The rebuild core (`kernel-cli/service`, bdk rebuild; design D-12): the
// repair path behind every exit 4 and the step that lets a fresh clone
// resume. Per Change: migrate older documents, rebuild the index rows,
// regenerate the part indexes, then read the trailers and check them.
import { join, relative, sep } from "node:path";

import type { Git } from "../git/index.ts";
import { KernelRefusal } from "../refusal/index.ts";
import type { ChangeLocation } from "./changes.ts";
import type { IndexDb } from "./index/open.ts";
import { rebuildChange } from "./index/refresh.ts";
import { taskProgress } from "./progress.ts";
import { migrateDocument, readDocument } from "./state/documents.ts";
import type { KindOverrides } from "./state/documents.ts";
import { generateDesignIndex, generatePlanIndex } from "./state/indexes.ts";
import { locate } from "./state/registry.ts";
import type { Store } from "./store.ts";
import { readAttempts, readPlanParts } from "./work.ts";

export interface RebuildResult {
  readonly changes: number;
  readonly entries: number;
  readonly attempts: number;
  readonly commits: number;
  /** Rewritten documents, relative to the project root. */
  readonly migrated: readonly string[];
  /** Documents left as they are, and indexes not regenerated, with the reason. */
  readonly warnings: readonly string[];
  /** One sentence per `state/trailer-mismatch`, naming both sides. */
  readonly mismatches: readonly string[];
}

export async function rebuildChanges(input: {
  readonly index: IndexDb;
  readonly git: Git;
  readonly locations: readonly ChangeLocation[];
  /** Replaces kinds, e.g. a later version with its migrations in tests. */
  readonly kinds?: KindOverrides;
}): Promise<RebuildResult> {
  const { index, git } = input;
  const { store, projectRoot } = index;
  const rel = (path: string): string => relative(projectRoot, path).split(sep).join("/");
  const totals = { entries: 0, attempts: 0, commits: 0 };
  const migrated: string[] = [];
  const warnings: string[] = [];
  const mismatches: string[] = [];

  for (const location of input.locations) {
    const skip = new Set<string>();
    const generated = regeneratedIndexes(store, location.dir);
    for (const path of filesUnder(store, location.dir)) {
      // An index regenerated below is rewritten whole, however broken it is now.
      if (locate(path) === undefined || generated.has(path)) continue;
      const result = migrateDocument(store, path, input.kinds);
      if (result.status === "migrated") migrated.push(rel(path));
      if (result.status === "skipped") {
        warnings.push(result.why);
        skip.add(path);
      }
    }
    rebuildChange(index, location, skip);

    regenerate(store, location.dir, "plan", warnings, rel);
    regenerate(store, location.dir, "design", warnings, rel);

    totals.entries += store
      .list(join(location.dir, "log"))
      .filter((name) => !name.endsWith("/") && !skip.has(join(location.dir, "log", name))).length;
    try {
      const attempts = readAttempts(store, location.dir);
      totals.attempts += attempts.length;
      const parts = readPlanParts(store, location.dir);
      const progress = await taskProgress(git, projectRoot, location.id, parts, attempts);
      totals.commits += progress.commits.length;
      mismatches.push(...progress.mismatches);
    } catch (error) {
      // A plan that does not parse leaves progress unchecked; a missing git is the caller's refusal.
      if (!(error instanceof KernelRefusal) || error.refusal.rule.startsWith("runtime/"))
        throw error;
      warnings.push(`${location.id}: progress not checked: ${error.refusal.why}`);
    }
  }
  return { changes: input.locations.length, ...totals, migrated, warnings, mismatches };
}

/** Every file below `dir`, depth first, in name order. */
function filesUnder(store: Store, dir: string): string[] {
  const files: string[] = [];
  for (const name of store.list(dir).sort()) {
    const path = join(dir, name.replace(/\/$/, ""));
    if (name.endsWith("/")) files.push(...filesUnder(store, path));
    else files.push(path);
  }
  return files;
}

/** The `<what>/index.md` files `regenerate` rewrites: those whose `<what>/parts/` holds parts. */
function regeneratedIndexes(store: Store, changeDir: string): Set<string> {
  return new Set(
    (["plan", "design"] as const)
      .filter((what) =>
        store.list(join(changeDir, what, "parts")).some((name) => name.endsWith(".md")),
      )
      .map((what) => join(changeDir, what, "index.md")),
  );
}

/** Rewrites `<what>/index.md` from `<what>/parts/` when the Change has parts; unchanged bytes are not rewritten. */
function regenerate(
  store: Store,
  changeDir: string,
  what: "plan" | "design",
  warnings: string[],
  rel: (path: string) => string,
): void {
  const partsDir = join(changeDir, what, "parts");
  const names = store.list(partsDir).filter((name) => name.endsWith(".md"));
  if (names.length === 0) return;
  const target = join(changeDir, what, "index.md");
  try {
    const parts = names.map((name) => {
      const document = readDocument(store, join(partsDir, name));
      const data = document !== undefined && "data" in document ? document.data : {};
      return {
        id: String(data.id),
        title: String(data.title),
        "depends-on": (data["depends-on"] as readonly string[] | undefined) ?? [],
      };
    });
    const text = what === "plan" ? generatePlanIndex(parts) : generateDesignIndex(parts);
    if (store.read(target) !== text) store.write(target, text);
  } catch (error) {
    if (!(error instanceof KernelRefusal)) throw error;
    warnings.push(`${rel(target)} not regenerated: ${error.refusal.why}`);
  }
}
