// The bundle and the dependency policy (`kernel-architecture`, Bundle and
// Runtime dependencies): `dist/bdk.mjs` loads nothing but Node built-ins, so
// the host needs no install, and the runtime dependencies stay on the allowlist.
import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { dependencyViolations } from "./support/dependencies.ts";
import type { PackageJson } from "./support/dependencies.ts";
import { BUNDLE, REPO_ROOT } from "./support/run.ts";

interface Load {
  readonly specifier: string;
  readonly kind: "static" | "dynamic" | "require";
}

/** Every module the bundle loads: static imports, dynamic imports, require calls. */
function loadsOf(text: string): Load[] {
  const source = ts.createSourceFile(
    "bdk.mjs",
    text,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  const loads: Load[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      loads.push({ specifier: node.moduleSpecifier.text, kind: "static" });
    } else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const literal = first !== undefined && ts.isStringLiteral(first) ? first.text : undefined;
      if (literal !== undefined && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        loads.push({ specifier: literal, kind: "dynamic" });
      } else if (
        literal !== undefined &&
        ts.isIdentifier(node.expression) &&
        /^_*require2?$/.test(node.expression.text)
      ) {
        loads.push({ specifier: literal, kind: "require" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return loads;
}

describe("dist/bdk.mjs", () => {
  const loads = loadsOf(readFileSync(BUNDLE, "utf8"));

  it("loads only Node built-ins", () => {
    expect(loads.length).toBeGreaterThan(0);
    expect(loads.filter((load) => !isBuiltin(load.specifier))).toStrictEqual([]);
  });

  it("has no static node:sqlite import, only the lazy one (design D-3)", () => {
    expect(
      loads.filter((load) => load.specifier === "node:sqlite" && load.kind !== "dynamic"),
    ).toStrictEqual([]);
  });

  it("detects a seeded package import, require and static node:sqlite", () => {
    const seeded = loadsOf('import "zod";\nconst y = __require("yaml");\nimport "node:sqlite";');
    expect(
      seeded.filter((load) => !isBuiltin(load.specifier)).map((load) => load.specifier),
    ).toStrictEqual(["zod", "yaml"]);
    expect(seeded).toContainEqual({ specifier: "node:sqlite", kind: "static" });
  });
});

describe("package.json", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as PackageJson;

  it("pins every dependency exactly and keeps runtime dependencies on the allowlist", () => {
    expect(dependencyViolations(pkg)).toStrictEqual([]);
  });

  it("fails on a seeded range", () => {
    const seeded = { ...pkg, devDependencies: { ...pkg.devDependencies, vitest: "^5.0.2" } };
    expect(dependencyViolations(seeded)).toStrictEqual(["vitest@^5.0.2 is not an exact version"]);
  });

  it("accepts a GitHub dependency pinned to a release tag, not to a branch", () => {
    const pinned = {
      ...pkg,
      devDependencies: { ...pkg.devDependencies, kit: "github:o/kit#v1.2.3" },
    };
    expect(dependencyViolations(pinned)).toStrictEqual([]);
    const branch = {
      ...pkg,
      devDependencies: { ...pkg.devDependencies, kit: "github:o/kit#main" },
    };
    expect(dependencyViolations(branch)).toStrictEqual([
      "kit@github:o/kit#main is not an exact version",
    ]);
  });

  it("fails on a seeded extra runtime dependency", () => {
    const seeded = { ...pkg, dependencies: { ...pkg.dependencies, lodash: "4.17.21" } };
    expect(dependencyViolations(seeded)).toStrictEqual([
      "lodash is not in the runtime allowlist (yaml, zod)",
    ]);
  });
});
