// The architecture lint of the bdk CLI (spec `bdk-cli`, "Vertical slices" to "OS boundary";
// design D5 of v3-178-bdk-plugin-skeleton). Generated from the slice matrix in `src/slices.ts`,
// so the root `eslint.config.mjs` and the tests build the same rules, each from its own matrix.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Linter } from "eslint";
import boundaries from "eslint-plugin-boundaries";

import type { SHARED, SLICES } from "./src/slices.ts";

export interface Matrix {
  readonly slices: typeof SLICES;
  readonly shared: typeof SHARED;
}

interface ElementSelector {
  readonly element: {
    readonly type: string;
    readonly captured?: Record<string, string>;
    readonly fileInternalPath?: string;
  };
}

interface Policy {
  readonly from: ElementSelector;
  readonly allow: { readonly to: ElementSelector | readonly ElementSelector[] };
}

/** The layers of a slice and the layers of the same slice each may import ("Slice anatomy"). */
const LAYERS: Readonly<Record<string, readonly string[]>> = {
  commands: ["use-cases", "render", "schema", "domain"],
  "use-cases": ["domain", "store", "schema"],
  domain: ["domain"],
  store: ["domain"],
  render: ["domain", "schema"],
  schema: ["domain"],
  tests: ["commands", "use-cases", "domain", "store", "render", "schema", "tests"],
};

/** Layers that may import `shared/`: all but `domain/`, which holds pure rules only. */
const SHARED_USERS = Object.keys(LAYERS).filter((layer) => layer !== "domain");

/** Node modules that reach the operating system ("OS boundary"). */
const OS_MODULES = [
  "fs",
  "fs/promises",
  "child_process",
  "os",
  "net",
  "http",
  "https",
  "readline",
  "tty",
  "worker_threads",
  "process",
];

/** The matrix and the source tree disagree; thrown while the config loads. */
export class ArchitectureError extends Error {}

function directories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function sameSet(actual: readonly string[], expected: readonly string[], what: string): void {
  const extra = actual.filter((name) => !expected.includes(name));
  const missing = expected.filter((name) => !actual.includes(name));
  if (extra.length > 0 || missing.length > 0) {
    throw new ArchitectureError(
      `${what}: directories without a matrix entry [${extra.join(", ")}], ` +
        `matrix entries without a directory [${missing.join(", ")}]`,
    );
  }
}

function findCycle(slices: Matrix["slices"]): string[] | undefined {
  const state = new Map<string, "open" | "done">();
  const visit = (name: string, path: readonly string[]): string[] | undefined => {
    if (state.get(name) === "done") return undefined;
    if (state.get(name) === "open") return [...path.slice(path.indexOf(name)), name];
    state.set(name, "open");
    for (const next of slices[name]?.imports ?? []) {
      const cycle = visit(next, [...path, name]);
      if (cycle) return cycle;
    }
    state.set(name, "done");
    return undefined;
  };
  for (const name of Object.keys(slices)) {
    const cycle = visit(name, []);
    if (cycle) return cycle;
  }
  return undefined;
}

function files(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    return entry.isDirectory() ? files(join(dir, entry.name), path) : [path];
  });
}

/** Where a file may sit under `src/` ("Vertical slices", "Slice anatomy"); undefined if it may. */
function misplaced(path: string): string | undefined {
  const [top, second, ...rest] = path.split("/");
  if (second === undefined) {
    return top === "main.ts" || top === "slices.ts"
      ? undefined
      : "only main.ts and slices.ts sit in src/";
  }
  if (top === "shared") return rest.length === 0 ? "a shared module is a directory" : undefined;
  if (rest.length === 0)
    return second === "index.ts" ? undefined : "a slice holds index.ts and its layer directories";
  return second in LAYERS ? undefined : `${second} is no layer (${Object.keys(LAYERS).join(", ")})`;
}

/** Fails `pnpm lint` before any file is linted when the matrix and the tree disagree. */
function checkMatrix(srcDir: string, { slices, shared }: Matrix): void {
  const names = Object.keys(slices);
  sameSet(
    directories(srcDir).filter((name) => name !== "shared"),
    [...names].sort(),
    `slices under ${srcDir}`,
  );
  const sharedDir = join(srcDir, "shared");
  const sharedDirs = directories(srcDir).includes("shared") ? directories(sharedDir) : [];
  sameSet(sharedDirs, Object.keys(shared).sort(), `shared modules under ${sharedDir}`);
  for (const path of files(srcDir)) {
    const reason = misplaced(path);
    if (reason !== undefined) throw new ArchitectureError(`${join(srcDir, path)}: ${reason}`);
  }
  for (const [name, { imports }] of Object.entries(slices)) {
    for (const target of imports) {
      if (!names.includes(target)) {
        throw new ArchitectureError(`slice ${name} may import ${target}, which is no slice`);
      }
    }
  }
  const cycle = findCycle(slices);
  if (cycle) throw new ArchitectureError(`the slice matrix has a cycle: ${cycle.join(" -> ")}`);
}

const element = (
  type: string,
  captured?: Record<string, string>,
  fileInternalPath?: string,
): ElementSelector => ({
  element: {
    type,
    ...(captured ? { captured } : {}),
    ...(fileInternalPath ? { fileInternalPath } : {}),
  },
});

// Elements, matched in this order: `shared` (src/shared/<module>), `layer`
// (src/<slice>/<layer>), `slice` (src/<slice>, holding only index.ts) and `root` (src,
// holding main.ts and slices.ts). Element patterns match folders, so a file's place inside
// its folder is its `fileInternalPath`.
function policies(slices: Matrix["slices"]): Policy[] {
  const same = "{{ from.element.captured.slice }}";
  const index = (slice: string): ElementSelector => element("slice", { slice }, "index.ts");
  const rules: Policy[] = [
    {
      from: element("root", undefined, "main.ts"),
      allow: { to: [element("slice", undefined, "index.ts"), element("shared")] },
    },
    { from: element("shared"), allow: { to: element("shared") } },
    {
      from: element("slice"),
      allow: { to: [element("layer", { slice: same }), element("shared")] },
    },
  ];
  for (const [layer, targets] of Object.entries(LAYERS)) {
    const to = targets.map((target) => element("layer", { slice: same, layer: target }));
    if (SHARED_USERS.includes(layer)) to.push(element("shared"));
    if (layer === "tests") to.push(index(same));
    rules.push({ from: element("layer", { layer }), allow: { to } });
  }
  for (const [name, { imports }] of Object.entries(slices)) {
    if (imports.length === 0) continue;
    rules.push({
      from: element("layer", { slice: name, layer: "use-cases" }),
      allow: { to: imports.map(index) },
    });
  }
  return rules;
}

/**
 * The flat-config blocks that enforce the slice architecture on the TypeScript files under
 * `srcDir`, a path relative to `cwd`, the directory ESLint runs in.
 */
export function architecture({
  cwd,
  srcDir,
  slices,
  shared,
}: Matrix & { readonly cwd: string; readonly srcDir: string }): Linter.Config[] {
  checkMatrix(join(cwd, srcDir), { slices, shared });
  const src = srcDir;
  const files = [`${src}/**/*.ts`];
  const osBoundaries = Object.entries(shared)
    .filter(([, entry]) => entry.admitted === "os-boundary")
    .map(([name]) => `${src}/shared/${name}/**/*.ts`);
  const restricted = OS_MODULES.flatMap((name) => [name, `node:${name}`]).map((name) => ({
    name,
    message:
      "OS access belongs in src/main.ts or a shared/ OS boundary module (spec bdk-cli, OS boundary).",
  }));
  return [
    {
      files,
      plugins: {
        boundaries: boundaries as unknown as NonNullable<Linter.Config["plugins"]>[string],
      },
      linterOptions: { noInlineConfig: true },
      settings: {
        "boundaries/root-path": cwd,
        "boundaries/elements": [
          { type: "shared", pattern: `${src}/shared/*`, partialMatch: false, capture: ["module"] },
          {
            type: "layer",
            pattern: `${src}/*/*`,
            partialMatch: false,
            capture: ["slice", "layer"],
          },
          { type: "slice", pattern: `${src}/*`, partialMatch: false, capture: ["slice"] },
          { type: "root", pattern: src, partialMatch: false },
        ],
      },
      rules: {
        "boundaries/dependencies": ["error", { default: "disallow", policies: policies(slices) }],
        "no-restricted-imports": ["error", { paths: restricted }],
        "no-restricted-globals": [
          "error",
          { name: "process", message: "Use what src/main.ts injects (spec bdk-cli, OS boundary)." },
        ],
      },
    },
    {
      files: [`${src}/main.ts`, ...osBoundaries],
      rules: { "no-restricted-imports": "off", "no-restricted-globals": "off" },
    },
  ];
}
