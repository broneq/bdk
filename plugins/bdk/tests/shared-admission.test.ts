import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

import { SHARED } from "../src/slices.ts";
import type { Matrix } from "../eslint.architecture.ts";

// Spec `bdk-cli`, "shared/ admission": a module admitted to shared/ because three or more
// slices use it must keep three importing slices. ESLint checks one import at a time and
// cannot count importers, so this check is a test (design D5).

const SRC = join(import.meta.dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** The slices that import each shared module, from every import of the files under `srcDir`. */
function sharedImporters(srcDir: string): Map<string, Set<string>> {
  const users = new Map<string, Set<string>>();
  for (const file of sourceFiles(srcDir)) {
    const [slice] = relative(srcDir, file).split(sep);
    if (slice === undefined || slice === "shared" || slice.endsWith(".ts")) continue;
    const { importedFiles } = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    for (const { fileName } of importedFiles) {
      if (!fileName.startsWith(".")) continue;
      const [top, module] = relative(srcDir, resolve(dirname(file), fileName)).split(sep);
      if (top !== "shared" || module === undefined) continue;
      users.set(module, (users.get(module) ?? new Set()).add(slice));
    }
  }
  return users;
}

/** The `three-slices` modules with fewer than three importing slices, and their importers. */
function underused(srcDir: string, shared: Matrix["shared"]): Record<string, string[]> {
  const users = sharedImporters(srcDir);
  return Object.fromEntries(
    Object.entries(shared)
      .filter(([, entry]) => entry.admitted === "three-slices")
      .map(([name]) => [name, [...(users.get(name) ?? [])].sort()] as const)
      .filter(([, slices]) => slices.length < 3),
  );
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function writeTree(tree: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "bdk-shared-"));
  roots.push(root);
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `${text}\n`);
  }
  return root;
}

describe("shared/ admission", () => {
  it("keeps three importing slices for every module admitted by use", () => {
    expect(underused(SRC, SHARED)).toEqual({});
  });

  it("names a module admitted by use that only two slices import", () => {
    const use = 'import { id } from "../../shared/ids/index.ts";\nexport const x = id;';
    const root = writeTree({
      "shared/ids/index.ts": 'export const id = "i";',
      "alpha/use-cases/a.ts": use,
      "beta/use-cases/b.ts": use,
      "gamma/index.ts": 'export const gamma = "g";',
    });
    const shared: Matrix["shared"] = { ids: { admitted: "three-slices", why: "ids" } };
    expect(underused(root, shared)).toEqual({ ids: ["alpha", "beta"] });
  });

  it("counts type-only imports and ignores imports from inside shared/", () => {
    const root = writeTree({
      "shared/ids/index.ts": "export type Id = string;",
      "shared/cli/index.ts": 'import type { Id } from "../ids/index.ts";\nexport type Cli = Id;',
      "alpha/domain/a.ts":
        'import type { Id } from "../../shared/ids/index.ts";\nexport type A = Id;',
      "beta/index.ts": 'export type { Id } from "../shared/ids/index.ts";',
      "gamma/render/g.ts":
        'import type { Id } from "../../shared/ids/index.ts";\nexport type G = Id;',
    });
    const shared: Matrix["shared"] = { ids: { admitted: "three-slices", why: "ids" } };
    expect(underused(root, shared)).toEqual({});
  });
});
