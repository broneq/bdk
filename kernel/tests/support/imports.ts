// The import scan and the `node:` boundary of `kernel-architecture` (Slice
// dependency matrix, Slice anatomy, shared/ admission rule). Files are passed
// in as text, so the negative controls seed violations without touching disk.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import ts from "typescript";

import { tableFirstColumn, backticked } from "./specs.ts";

export interface SourceFile {
  /** Path relative to `kernel/src/`, with `/` separators. */
  readonly path: string;
  readonly text: string;
}

interface Import {
  readonly from: string;
  readonly specifier: string;
  readonly typeOnly: boolean;
}

/** Slice -> the slices it may import; "all" for the `service` row. */
export type Matrix = ReadonlyMap<string, ReadonlySet<string> | "all">;

const LAYERS = ["commands", "use-cases", "domain", "store", "render", "schema"] as const;
type Layer = (typeof LAYERS)[number];

/** Same-slice edges of the anatomy; a layer always reaches its own directory. */
const LAYER_MAY_IMPORT: Readonly<Record<Layer, readonly Layer[]>> = {
  commands: ["use-cases", "render", "schema"],
  "use-cases": ["domain", "store", "schema"],
  store: ["domain"],
  render: ["domain"],
  schema: ["domain"],
  domain: [],
};

/** Layers that import no package and no `node:` module. */
const PURE_LAYERS: readonly Layer[] = ["domain", "render"];

const NODE_BOUNDARY: Readonly<Record<string, readonly string[]>> = {
  fs: ["shared/store/", "shared/config/", "shared/git/"],
  child_process: ["shared/git/", "dispatch/use-cases/run.ts"],
  sqlite: ["shared/store/"],
};

const COMPOSITION_ROOT = ["main.ts", "registrations.ts"];

/** Production sources under `srcRoot`: tests, E2E files and `tests/` directories excluded. */
export function readSources(srcRoot: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests") walk(full);
      } else if (entry.name.endsWith(".ts") && !/\.(test|e2e)\.ts$/.test(entry.name)) {
        files.push({
          path: relative(srcRoot, full).split(sep).join("/"),
          text: readFileSync(full, "utf8"),
        });
      }
    }
  };
  walk(srcRoot);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function collectImports(file: SourceFile): Import[] {
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true);
  const imports: Import[] = [];
  const add = (specifier: ts.Node | undefined, typeOnly: boolean): void => {
    if (specifier !== undefined && ts.isStringLiteral(specifier)) {
      imports.push({ from: file.path, specifier: specifier.text, typeOnly });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const allTypes =
        clause !== undefined &&
        clause.name === undefined &&
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((element) => element.isTypeOnly);
      add(node.moduleSpecifier, clause?.phaseModifier === ts.SyntaxKind.TypeKeyword || allTypes);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

/** The dependency matrix, read from the `From | May import` table of the spec. */
export function readMatrix(architectureSpec: string): Matrix {
  const matrix = new Map<string, ReadonlySet<string> | "all">();
  for (const [from = "", mayImport = ""] of tableFirstColumn(architectureSpec, "From")) {
    const targets: ReadonlySet<string> | "all" = mayImport.includes("every slice")
      ? "all"
      : new Set(backticked(mayImport).filter((name) => name !== "shared"));
    for (const slice of backticked(from)) matrix.set(slice, targets);
  }
  return matrix;
}

interface Place {
  readonly kind: "root" | "shared" | "slice" | "outside";
  /** The shared module or the slice. */
  readonly unit: string;
  /** The slice layer, or "index" for the slice's `index.ts`. */
  readonly layer?: Layer | "index";
  readonly path: string;
}

function place(path: string): Place {
  if (path.startsWith("../")) return { kind: "outside", unit: "", path };
  if (COMPOSITION_ROOT.includes(path)) return { kind: "root", unit: "", path };
  const [top = "", second = ""] = path.split("/");
  if (top === "shared") return { kind: "shared", unit: second, path };
  const layer =
    second === "index.ts"
      ? "index"
      : (LAYERS as readonly string[]).includes(second)
        ? (second as Layer)
        : undefined;
  return layer === undefined
    ? { kind: "slice", unit: top, path }
    : { kind: "slice", unit: top, layer, path };
}

export function importViolations(files: readonly SourceFile[], matrix: Matrix): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const from = place(file.path);
    for (const edge of collectImports(file)) {
      const problem = edge.specifier.startsWith(".")
        ? internalProblem(
            from,
            place(posix.normalize(posix.join(posix.dirname(file.path), edge.specifier))),
            edge,
            matrix,
          )
        : packageProblem(from);
      if (problem !== undefined) violations.push(`${file.path} -> ${edge.specifier}: ${problem}`);
    }
  }
  return violations;
}

function packageProblem(from: Place): string | undefined {
  if (
    from.kind === "slice" &&
    from.layer !== undefined &&
    from.layer !== "index" &&
    PURE_LAYERS.includes(from.layer)
  ) {
    return `${from.layer}/ imports no package or node: module`;
  }
  return undefined;
}

function internalProblem(from: Place, to: Place, edge: Import, matrix: Matrix): string | undefined {
  if (to.kind === "outside")
    return from.kind === "root"
      ? undefined
      : "only the composition root reads files outside kernel/src";
  if (to.kind === "root")
    return from.kind === "root" ? undefined : "only the composition root imports itself";

  if (to.kind === "shared") {
    if (from.kind === "shared" && from.unit === to.unit) return undefined;
    if (to.path !== `shared/${to.unit}/index.ts`)
      return `deep import into shared/${to.unit}; use its index.ts`;
    if (from.kind !== "slice" || from.layer === undefined || from.layer === "index")
      return undefined;
    if (from.layer === "domain") {
      return edge.typeOnly && (to.unit === "ids" || to.unit === "clock")
        ? undefined
        : "domain/ imports nothing but types from shared/ids and shared/clock";
    }
    if (from.layer === "render" || from.layer === "schema")
      return `${from.layer}/ imports domain/ only`;
    return undefined;
  }

  // to is a slice
  if (from.kind === "shared") return "shared/ never imports a slice";
  if (from.kind === "root")
    return to.layer === "index" ? undefined : `deep import into ${to.unit}; use its index.ts`;
  if (from.unit !== to.unit) {
    if (to.layer !== "index") return `deep import into ${to.unit}; use its index.ts`;
    if (from.layer !== "use-cases")
      return `only use-cases/ imports another slice, not ${from.layer ?? "this file"}`;
    const allowed = matrix.get(from.unit);
    if (allowed === "all" || allowed?.has(to.unit) === true) return undefined;
    return `${from.unit} -> ${to.unit} is not in the dependency matrix`;
  }
  if (from.layer === "index") return undefined;
  if (to.layer === "index") return "a layer never imports its own slice's index.ts";
  if (from.layer === undefined || to.layer === undefined) return "file outside the slice anatomy";
  if (from.layer === to.layer || LAYER_MAY_IMPORT[from.layer].includes(to.layer)) return undefined;
  return `${from.layer}/ may not import ${to.layer}/`;
}

export function nodeViolations(files: readonly SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    for (const { specifier } of collectImports(file)) {
      const bare = specifier.split("/")[0] ?? "";
      if (!specifier.startsWith("node:") && bare in NODE_BOUNDARY) {
        violations.push(`${file.path} -> ${specifier}: use the node: prefix`);
        continue;
      }
      const module = specifier.startsWith("node:") ? (specifier.slice(5).split("/")[0] ?? "") : "";
      const allowed = NODE_BOUNDARY[module];
      if (allowed !== undefined && !allowed.some((prefix) => file.path.startsWith(prefix))) {
        violations.push(`${file.path} -> ${specifier}: allowed only in ${allowed.join(", ")}`);
      }
    }
  }
  return violations;
}
