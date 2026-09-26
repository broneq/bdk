// A configuration with problems as one refusal: the first problem names the
// key, the layer, the file and the count of further errors, and `instead`
// names the schema to read and the file to fix. Every command that resolves
// settings answers the same way.
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import type { Store } from "../store/index.ts";
import type { ConfigProblem } from "./problems.ts";
import type { ConfigRegistry } from "./registry.ts";
import { resolveConfig } from "./resolve.ts";
import type { Resolution } from "./resolve.ts";
import type { Mapping } from "./values.ts";

/** Where the layers are and what declares the keys. */
export interface ResolveScope {
  readonly store: Store;
  readonly settings: ConfigRegistry;
  readonly globalDir: string;
  readonly projectRoot: string;
  readonly pluginRoot: string;
}

export type Resolved = Resolution & { readonly value: Mapping };

/** The resolution, or the refusal of its first problem. */
export function resolveOrRefuse(
  scope: ResolveScope,
  options: { readonly store?: Store; readonly removed?: "report" | "ignore" } = {},
): Resolved | Refusal {
  const resolution = resolveConfig({
    store: options.store ?? scope.store,
    registry: scope.settings,
    globalDir: scope.globalDir,
    projectRoot: scope.projectRoot,
    pluginRoot: scope.pluginRoot,
    ...(options.removed === undefined ? {} : { removed: options.removed }),
  });
  const [first, ...rest] = resolution.problems;
  if (first !== undefined) return problemRefusal(scope, first, rest.length);
  if (resolution.value === undefined) throw new Error("a resolution without problems has a value");
  return { ...resolution, value: resolution.value };
}

export function problemRefusal(
  scope: Pick<ResolveScope, "settings" | "projectRoot">,
  problem: ConfigProblem,
  more: number,
): Refusal {
  const file = problem.path === undefined ? undefined : displayPath(scope, problem.path);
  const where = `the ${problem.layer} layer${file === undefined ? "" : ` (${file})`}`;
  const count = more === 0 ? "" : ` (${more} more error${more === 1 ? "" : "s"})`;
  return refuse(problem.rule, `${problem.key} in ${where}: ${problem.message}${count}`, [
    schemaCommand(scope, problem.key),
    ...(file === undefined ? [] : [`fix ${file}`]),
  ]);
}

/** `bdk config schema <module>` for a key of a registered module, else the whole schema. */
export function schemaCommand(scope: Pick<ResolveScope, "settings">, key: string): string {
  const module = key.split(".")[0] ?? "";
  return scope.settings.modules.some((candidate) => candidate.key === module)
    ? `bdk config schema ${module}`
    : "bdk config schema";
}

/** A path below the project root relative to it; any other path as is. */
export function displayPath(scope: Pick<ResolveScope, "projectRoot">, path: string): string {
  const root = `${scope.projectRoot}/`;
  return path.startsWith(root) ? path.slice(root.length) : path;
}
