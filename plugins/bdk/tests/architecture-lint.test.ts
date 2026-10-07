import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { afterEach, describe, expect, it } from "vitest";

import { architecture, ArchitectureError } from "../eslint.architecture.ts";
import type { Matrix } from "../eslint.architecture.ts";

// Each case writes a small source tree to a temporary directory and lints it with the rules
// generated from its own matrix, so every check of design D5 is shown to fail on a violation.

type Tree = Readonly<Record<string, string>>;

const MATRIX: Matrix = {
  slices: {
    alpha: { imports: ["beta"], why: "alpha's use case calls beta's" },
    beta: { imports: [], why: "leaf" },
  },
  shared: {
    cli: { admitted: "frame", why: "the frame" },
    files: { admitted: "os-boundary", why: "file system" },
  },
};

/** A tree that follows every rule; each case changes one file of it. */
const VALID: Tree = {
  "src/main.ts": [
    'import { alpha } from "./alpha/index.ts";',
    'import { run } from "./shared/cli/index.ts";',
    "process.exitCode = run(alpha);",
  ].join("\n"),
  "src/slices.ts": "export const SLICES = {};",
  "src/shared/cli/index.ts": "export const run = (value: string): number => value.length;",
  "src/shared/files/index.ts": [
    'import { readFileSync } from "node:fs";',
    'export const read = (path: string): string => readFileSync(path, "utf8");',
  ].join("\n"),
  "src/alpha/index.ts": 'export { alpha } from "./commands/show.ts";',
  "src/alpha/commands/show.ts": [
    'import { show } from "../use-cases/show.ts";',
    'import { render } from "../render/show.ts";',
    "export const alpha = render(show());",
  ].join("\n"),
  "src/alpha/use-cases/show.ts": [
    'import type { Item } from "../domain/item.ts";',
    'import { beta } from "../../beta/index.ts";',
    'import { read } from "../../shared/files/index.ts";',
    'export const show = (): Item => ({ name: beta + read("x") });',
  ].join("\n"),
  "src/alpha/domain/item.ts": "export interface Item { name: string }",
  "src/alpha/render/show.ts": [
    'import type { Item } from "../domain/item.ts";',
    "export const render = (item: Item): string => item.name;",
  ].join("\n"),
  "src/alpha/tests/show.test.ts": [
    'import { show } from "../use-cases/show.ts";',
    'import { alpha } from "../index.ts";',
    "export const checked = [show(), alpha];",
  ].join("\n"),
  "src/beta/index.ts": 'export const beta = "b";',
};

const roots: string[] = [];

function writeTree(tree: Tree): string {
  const root = mkdtempSync(join(tmpdir(), "bdk-architecture-"));
  roots.push(root);
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `${text}\n`);
  }
  return root;
}

interface Report {
  readonly file: string;
  readonly rule: string | null;
  readonly line: number;
}

async function lint(tree: Tree, matrix: Matrix = MATRIX): Promise<Report[]> {
  const cwd = writeTree(tree);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
      ...architecture({ cwd, srcDir: "src", ...matrix }),
    ],
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  return results.flatMap((result) =>
    result.messages.map((message) => ({
      file: result.filePath.slice(cwd.length + 1),
      rule: message.ruleId,
      line: message.line,
    })),
  );
}

function withFile(path: string, text: string): Tree {
  return { ...VALID, [path]: text };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("architecture lint", () => {
  it("accepts a tree that follows the slice architecture", async () => {
    expect(await lint(VALID)).toEqual([]);
  });

  it("rejects a slice import outside the matrix row", async () => {
    const reports = await lint(
      withFile(
        "src/beta/index.ts",
        'import { alpha } from "../alpha/index.ts";\nexport const beta = alpha;',
      ),
    );
    expect(reports).toContainEqual({
      file: "src/beta/index.ts",
      rule: "boundaries/dependencies",
      line: 1,
    });
  });

  it("rejects a type-only slice import outside the matrix row", async () => {
    const reports = await lint({
      ...VALID,
      "src/beta/index.ts":
        'export type { Item } from "../alpha/domain/item.ts";\nexport const beta = "b";',
    });
    expect(reports).toContainEqual({
      file: "src/beta/index.ts",
      rule: "boundaries/dependencies",
      line: 1,
    });
  });

  it("rejects a deep import into another slice", async () => {
    const reports = await lint({
      ...withFile(
        "src/alpha/use-cases/show.ts",
        [
          'import type { Item } from "../domain/item.ts";',
          'import { value } from "../../beta/domain/value.ts";',
          "export const show = (): Item => ({ name: value });",
        ].join("\n"),
      ),
      "src/beta/domain/value.ts": 'export const value = "v";',
    });
    expect(reports).toContainEqual({
      file: "src/alpha/use-cases/show.ts",
      rule: "boundaries/dependencies",
      line: 2,
    });
  });

  it("rejects a slice import from a layer other than use-cases", async () => {
    const reports = await lint(
      withFile(
        "src/alpha/render/show.ts",
        [
          'import type { Item } from "../domain/item.ts";',
          'import { beta } from "../../beta/index.ts";',
          "export const render = (item: Item): string => item.name + beta;",
        ].join("\n"),
      ),
    );
    expect(reports).toContainEqual({
      file: "src/alpha/render/show.ts",
      rule: "boundaries/dependencies",
      line: 2,
    });
  });

  it("rejects an import against the layer direction", async () => {
    const reports = await lint(
      withFile(
        "src/alpha/render/show.ts",
        [
          'import type { Item } from "../domain/item.ts";',
          'import { show } from "../use-cases/show.ts";',
          "export const render = (item: Item): string => item.name + show().name;",
        ].join("\n"),
      ),
    );
    expect(reports).toContainEqual({
      file: "src/alpha/render/show.ts",
      rule: "boundaries/dependencies",
      line: 2,
    });
  });

  it("rejects domain/ importing shared/", async () => {
    const reports = await lint(
      withFile(
        "src/alpha/domain/item.ts",
        'import { run } from "../../shared/cli/index.ts";\nexport interface Item { name: string }\nexport const size = run;',
      ),
    );
    expect(reports).toContainEqual({
      file: "src/alpha/domain/item.ts",
      rule: "boundaries/dependencies",
      line: 1,
    });
  });

  it("rejects shared/ importing a slice", async () => {
    const reports = await lint(
      withFile(
        "src/shared/cli/index.ts",
        'import { beta } from "../../beta/index.ts";\nexport const run = (value: string): number => value.length + beta.length;',
      ),
    );
    expect(reports).toContainEqual({
      file: "src/shared/cli/index.ts",
      rule: "boundaries/dependencies",
      line: 1,
    });
  });

  it.each([
    ["src/alpha/helper.ts", /alpha\/helper\.ts: a slice holds index\.ts/],
    ["src/alpha/utils/helper.ts", /utils is no layer/],
    ["src/helper.ts", /only main\.ts and slices\.ts/],
    ["src/shared/helper.ts", /a shared module is a directory/],
  ])("fails to load when %s is out of place", (path, message) => {
    const cwd = writeTree({ ...VALID, [path]: 'export const helper = "h";' });
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX })).toThrow(message);
  });

  it.each(["node:fs", "fs", "node:child_process", "node:process"])(
    "rejects %s outside an OS boundary module",
    async (module) => {
      const reports = await lint(
        withFile(
          "src/beta/index.ts",
          `import * as os from "${module}";\nexport const beta = String(os);`,
        ),
      );
      expect(reports).toContainEqual({
        file: "src/beta/index.ts",
        rule: "no-restricted-imports",
        line: 1,
      });
    },
  );

  it("rejects the process global outside main.ts", async () => {
    const reports = await lint(
      withFile("src/beta/index.ts", 'export const beta = process.env.HOME ?? "";'),
    );
    expect(reports).toContainEqual({
      file: "src/beta/index.ts",
      rule: "no-restricted-globals",
      line: 1,
    });
  });

  it("ignores inline disable comments", async () => {
    const reports = await lint(
      withFile(
        "src/beta/index.ts",
        [
          "// eslint-disable-next-line boundaries/dependencies",
          'import { alpha } from "../alpha/index.ts";',
          "export const beta = alpha;",
        ].join("\n"),
      ),
    );
    expect(reports).toContainEqual({
      file: "src/beta/index.ts",
      rule: "boundaries/dependencies",
      line: 2,
    });
  });

  it("fails to load when a slice directory has no matrix entry", () => {
    const cwd = writeTree({ ...VALID, "src/gamma/index.ts": "export const gamma = 1;" });
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX })).toThrow(ArchitectureError);
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX })).toThrow(/gamma/);
  });

  it("fails to load when a shared directory has no matrix entry", () => {
    const cwd = writeTree({ ...VALID, "src/shared/clock/index.ts": "export const now = 1;" });
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX })).toThrow(/clock/);
  });

  it("fails to load when the matrix names an unknown slice", () => {
    const cwd = writeTree(VALID);
    const slices = { ...MATRIX.slices, beta: { imports: ["gamma"], why: "typo" } };
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX, slices })).toThrow(/gamma/);
  });

  it("fails to load when the matrix has a cycle", () => {
    const cwd = writeTree(VALID);
    const slices = { ...MATRIX.slices, beta: { imports: ["alpha"], why: "back edge" } };
    expect(() => architecture({ cwd, srcDir: "src", ...MATRIX, slices })).toThrow(
      /alpha -> beta -> alpha/,
    );
  });
});
