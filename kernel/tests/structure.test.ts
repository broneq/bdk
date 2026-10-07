// `kernel-architecture`, Tests per slice, structural tests 1 and 2. Each rule
// has a negative control: a seeded file that must produce exactly one finding.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import commands from "../../schema/cli/commands.json" with { type: "json" };
import { registrations, settingsRegistry } from "../src/registrations.ts";
import { createRegistry, loadIndex } from "../src/shared/registry/index.ts";
import { systemClock } from "../src/shared/clock/index.ts";
import { systemGit } from "../src/shared/git/index.ts";
import { memoryIndex, memoryRegistry, memoryStore } from "../src/shared/store/index.ts";
import { consumerViolations } from "./support/consumers.ts";
import type { ConsumerWorld, Declared } from "./support/consumers.ts";
import { importViolations, nodeViolations, readMatrix, readSources } from "./support/imports.ts";
import type { SourceFile } from "./support/imports.ts";
import { REPO_ROOT } from "./support/run.ts";
import { backticked, tableFirstColumn } from "./support/specs.ts";

const sources = readSources(join(REPO_ROOT, "kernel", "src"));
const matrix = readMatrix(
  readFileSync(join(REPO_ROOT, "openspec/specs/kernel-architecture/spec.md"), "utf8"),
);

function seeded(path: string, text: string): readonly SourceFile[] {
  return [...sources, { path, text }];
}

describe("import scan", () => {
  it("reads the matrix from the spec", () => {
    expect(matrix.get("attempt")).toStrictEqual(new Set(["part", "log", "evidence", "graph"]));
    expect(matrix.get("service")).toBe("all");
    expect(matrix.get("log")).toStrictEqual(new Set());
    expect(matrix.get("rules")).toStrictEqual(new Set());
    expect(matrix.get("review")).toStrictEqual(new Set(["measure", "spec"]));
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
      "schema/ importing a shared module other than vocabulary",
      "log/schema/extra.ts",
      'import { x } from "../../shared/ids/index.ts";',
    ],
    [
      "shared/vocabulary importing another shared module",
      "shared/vocabulary/extra.ts",
      'import { x } from "../ids/index.ts";',
    ],
    [
      "shared/vocabulary importing its own files",
      "shared/vocabulary/extra.ts",
      'import { x } from "./index.ts";',
    ],
    [
      "shared/vocabulary importing a package",
      "shared/vocabulary/extra.ts",
      'import * as z from "zod";',
    ],
    [
      "shared/ importing a slice",
      "shared/output/extra.ts",
      'import { x } from "../../service/index.ts";',
    ],
    [
      "config.ts importing a shared module other than config",
      "ctx/config.ts",
      'import { x } from "../shared/store/index.ts";',
    ],
    ["config.ts importing a package other than zod", "ctx/config.ts", 'import { x } from "yaml";'],
    [
      "config.ts importing a layer of its slice",
      "ctx/config.ts",
      'import { x } from "./domain/names.ts";',
    ],
    [
      "commands/ reading config.ts",
      "service/commands/extra.ts",
      'import { x } from "../config.ts";',
    ],
    [
      "a layer importing its own index.ts",
      "service/use-cases/extra.ts",
      'import { x } from "../index.ts";',
    ],
  ])("fails on %s", (_, path, text) => {
    expect(importViolations(seeded(path, text), matrix)).toHaveLength(1);
  });

  it("allows use-cases/ to read its own config.ts", () => {
    const text = 'import { toolsModule } from "../config.ts";';
    expect(importViolations(seeded("ctx/use-cases/skill.ts", text), matrix)).toStrictEqual([]);
  });

  it("allows shared/vocabulary in domain/, render/ and schema/", () => {
    const text = 'import { ENTRY_TYPES } from "../../shared/vocabulary/index.ts";';
    for (const path of ["graph/domain/node.ts", "log/render/extra.ts", "log/schema/extra.ts"]) {
      expect(importViolations(seeded(path, text), matrix)).toStrictEqual([]);
    }
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
      'import { existsSync, readdirSync, readFileSync } from "node:fs";',
    ],
    [
      "node:fs/promises in registry",
      "shared/registry/extra.ts",
      'import { readFile } from "node:fs/promises";',
    ],
    [
      "node:child_process in a slice",
      "dispatch/use-cases/run.ts",
      'import { spawn } from "node:child_process";',
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
});

// `kernel-architecture`, scenario "one selection for every reader" (#153): a
// rule's `paths` and `stages` decide who reads it, so no source maps a role, a
// skill or a node to pack prefixes or categories. Only `PACK_DIRS`, the
// directory-to-prefix table of the rules slice, names them.
const PACK_TABLE = "rules/domain/rule.ts";
const PACK_NAME =
  /["'`](?:BDK-)?(?:ARCH|CQ|DP|SEC|TQ|EJ|PL|JS|TS|REACT)["'`]|["'`](?:code-quality|design-patterns|engineering-judgment|test-quality)["'`]|["'`]rules\/(?:\$\{|[a-z])/;

function ruleTableViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter((file) => file.path !== PACK_TABLE && !file.path.includes("/tests/"))
    .filter((file) => PACK_NAME.test(file.text))
    .map((file) => file.path);
}

describe("one selection for every reader", () => {
  it("finds no table of pack prefixes or categories outside the rules slice's pack table", () => {
    expect(ruleTableViolations(sources)).toStrictEqual([]);
  });

  it.each([
    [
      "a role-to-prefix table",
      "dispatch/use-cases/table.ts",
      'const ROLE_PREFIXES = { verifier: ["PL", "TQ"] };',
    ],
    [
      "a skill naming a category",
      "ctx/use-cases/extra.ts",
      'const parts = [rules("code-quality")];',
    ],
    ["a node's category path", "graph/use-cases/extra.ts", "const dir = `rules/${category}`;"],
    ["a bundle prefix", "rules/use-cases/extra.ts", 'const verifier = ["BDK-CQ"];'],
  ])("fails on %s", (_, path, text) => {
    expect(ruleTableViolations(seeded(path, text))).toStrictEqual([path]);
  });
});

describe("config consumers (S6)", async () => {
  const architecture = readFileSync(
    join(REPO_ROOT, "openspec/specs/kernel-architecture/spec.md"),
    "utf8",
  );
  const slices = new Set(
    tableFirstColumn(architecture, "Slice").flatMap((row) => backticked(row[0] ?? "")),
  );
  const settings = settingsRegistry();
  const declared: Declared[] = [
    ...settings.modules.map((module) => ({
      key: module.key,
      consumer: module.consumer,
      value: module,
    })),
    ...settings.prompts.map((prompt) => ({
      key: prompt.key,
      consumer: prompt.consumer,
      value: prompt,
    })),
  ];
  const exports = new Map<string, Record<string, unknown>>();
  for (const consumer of new Set(declared.map((entry) => entry.consumer))) {
    const file =
      consumer === "shared/config" ? "shared/config/modules.ts" : `${consumer}/config.ts`;
    const path = join(REPO_ROOT, "kernel", "src", file);
    if (existsSync(path)) exports.set(consumer, (await import(path)) as Record<string, unknown>);
  }
  const index = loadIndex(commands);
  const registry = createRegistry(
    index,
    registrations({
      store: memoryStore(),
      pluginRoot: "/",
      contract: index.contract,
      commands: index,
      settings,
      git: systemGit,
      openIndex: memoryIndex,
      openRegistry: memoryRegistry(),
      clock: systemClock,
    }),
  );
  const handlerSlices = new Set(
    index.commands
      .filter((record) => registry.implementation(record.id) === "handler")
      .map((record) => record.slice),
  );
  const world: ConsumerWorld = {
    slices,
    exportsOf: (consumer) => exports.get(consumer),
    handlerSlices,
    useCases(slice) {
      const dir = join(REPO_ROOT, "kernel", "src", slice, "use-cases");
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith(".ts"))
        .map((name) => readFileSync(join(dir, name), "utf8"));
    },
  };

  it("reads the slices from the spec and finds the T12 modules", () => {
    expect(slices.has("ctx")).toBe(true);
    expect(declared.map((entry) => entry.key)).toContain("tools");
  });

  it("finds no violation in the registry", () => {
    expect(consumerViolations(declared, world)).toStrictEqual([]);
  });

  const [first] = declared;
  if (first === undefined) throw new Error("the registry declares no module");

  it("fails on a consumer that is not a slice", () => {
    const seeded = { ...first, consumer: "nosuch" };
    expect(consumerViolations([seeded], world)).toHaveLength(1);
  });

  it("fails on a module its consumer's config.ts does not export", () => {
    const seeded = { ...first, value: { key: first.key } };
    expect(consumerViolations([seeded], world)).toHaveLength(1);
  });

  it("fails on a consumer with a handler whose use cases never read the module", () => {
    const withHandler: ConsumerWorld = {
      ...world,
      handlerSlices: new Set([first.consumer]),
      useCases: () => [],
    };
    expect(consumerViolations([first], withHandler)).toHaveLength(1);
    const reading: ConsumerWorld = {
      ...withHandler,
      useCases: () => [`read(${Object.keys(world.exportsOf(first.consumer) ?? {}).join(", ")})`],
    };
    expect(consumerViolations([first], reading)).toStrictEqual([]);
  });
});
