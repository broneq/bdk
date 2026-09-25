// `kernel-architecture`, Tests per slice, structural tests 1 and 2. Each rule
// has a negative control: a seeded file that must produce exactly one finding.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { importViolations, nodeViolations, readMatrix, readSources } from "./support/imports.ts";
import type { SourceFile } from "./support/imports.ts";
import { REPO_ROOT } from "./support/run.ts";

const sources = readSources(join(REPO_ROOT, "kernel", "src"));
const matrix = readMatrix(
  readFileSync(join(REPO_ROOT, "openspec/specs/kernel-architecture/spec.md"), "utf8"),
);

function seeded(path: string, text: string): readonly SourceFile[] {
  return [...sources, { path, text }];
}

describe("import scan", () => {
  it("reads the matrix from the spec", () => {
    expect(matrix.get("attempt")).toStrictEqual(new Set(["part", "log", "evidence"]));
    expect(matrix.get("service")).toBe("all");
    expect(matrix.get("log")).toStrictEqual(new Set());
  });

  it("finds no violation in kernel/src", () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(importViolations(sources, matrix)).toStrictEqual([]);
  });

  it.each([
    [
      "a deep import into another slice",
      "graph/use-cases/done.ts",
      'import { x } from "../../log/use-cases/add.ts";',
    ],
    [
      "a deep import into shared",
      "graph/use-cases/done.ts",
      'import { x } from "../../shared/store/store.ts";',
    ],
    [
      "a reverse edge of the matrix",
      "log/use-cases/add.ts",
      'import { x } from "../../graph/index.ts";',
    ],
    [
      "an edge outside the matrix",
      "ctx/use-cases/skill.ts",
      'import { x } from "../../attempt/index.ts";',
    ],
    [
      "a slice import from commands/",
      "graph/commands/done.ts",
      'import { x } from "../../log/index.ts";',
    ],
    [
      "render/ importing use-cases/",
      "service/render/extra.ts",
      'import { x } from "../use-cases/doctor.ts";',
    ],
    [
      "commands/ importing store/",
      "graph/commands/done.ts",
      'import { x } from "../store/nodes.ts";',
    ],
    [
      "domain/ importing shared values",
      "graph/domain/node.ts",
      'import { newId } from "../../shared/ids/index.ts";',
    ],
    ["domain/ importing a package", "graph/domain/node.ts", 'import * as z from "zod";'],
    [
      "shared/ importing a slice",
      "shared/output/extra.ts",
      'import { x } from "../../service/index.ts";',
    ],
    [
      "a layer importing its own index.ts",
      "service/use-cases/extra.ts",
      'import { x } from "../index.ts";',
    ],
  ])("fails on %s", (_, path, text) => {
    expect(importViolations(seeded(path, text), matrix)).toHaveLength(1);
  });

  it("allows type imports from shared/ids and shared/clock in domain/", () => {
    const text =
      'import type { Clock } from "../../shared/clock/index.ts";\nimport { type IdPrefix } from "../../shared/ids/index.ts";';
    expect(importViolations(seeded("graph/domain/node.ts", text), matrix)).toStrictEqual([]);
  });
});

describe("node: boundary", () => {
  it("finds no violation in kernel/src", () => {
    expect(nodeViolations(sources)).toStrictEqual([]);
  });

  it.each([
    [
      "node:fs in service/",
      "service/use-cases/extra.ts",
      'import { readFileSync } from "node:fs";',
    ],
    [
      "node:fs/promises in registry",
      "shared/registry/extra.ts",
      'import { readFile } from "node:fs/promises";',
    ],
    [
      "node:child_process in store",
      "shared/store/extra.ts",
      'import { spawn } from "node:child_process";',
    ],
    [
      "a dynamic node:sqlite outside store",
      "shared/config/extra.ts",
      'const s = await import("node:sqlite");',
    ],
    [
      "a builtin without the node: prefix",
      "shared/store/extra.ts",
      'import { readFileSync } from "fs";',
    ],
  ])("fails on %s", (_, path, text) => {
    expect(nodeViolations(seeded(path, text))).toHaveLength(1);
  });

  it("allows node:child_process in the dispatch runner", () => {
    const text = 'import { spawn } from "node:child_process";';
    expect(nodeViolations(seeded("dispatch/use-cases/run.ts", text))).toStrictEqual([]);
  });
});
