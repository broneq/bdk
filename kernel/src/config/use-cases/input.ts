// What every `config` use case works on, and the resolution they share: the
// layers resolved once, and every configuration error turned into one refusal
// that names the key, the layer, the file and the count of further errors.
import { resolveConfig } from "../../shared/config/index.ts";
import type {
  ConfigProblem,
  ConfigRegistry,
  Mapping,
  Resolution,
} from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Store } from "../../shared/store/index.ts";

/** What the composition root provides. */
export interface ConfigDeps {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}

/** The command adds where the layers are. */
export interface ConfigInput extends ConfigDeps {
  readonly globalDir: string;
  readonly projectRoot: string;
}

export type Resolved = Resolution & { readonly value: Mapping };

export function resolve(input: ConfigInput, store: Store = input.store): Resolved | Refusal {
  const resolution = resolveConfig({
    store,
    registry: input.settings,
    globalDir: input.globalDir,
    projectRoot: input.projectRoot,
    pluginRoot: input.pluginRoot,
  });
  const [first, ...rest] = resolution.problems;
  if (first !== undefined) return problemRefusal(input, first, rest.length);
  if (resolution.value === undefined) throw new Error("a resolution without problems has a value");
  return { ...resolution, value: resolution.value };
}

function problemRefusal(input: ConfigInput, problem: ConfigProblem, more: number): Refusal {
  const file = problem.path === undefined ? undefined : displayPath(input, problem.path);
  const where = `the ${problem.layer} layer${file === undefined ? "" : ` (${file})`}`;
  const count = more === 0 ? "" : ` (${more} more error${more === 1 ? "" : "s"})`;
  return refuse(problem.rule, `${problem.key} in ${where}: ${problem.message}${count}`, [
    schemaCommand(input, problem.key),
    ...(file === undefined ? [] : [`fix ${file}`]),
  ]);
}

/** `bdk config schema <module>` for a key of a registered module, else the whole schema. */
export function schemaCommand(input: ConfigInput, key: string): string {
  const module = key.split(".")[0] ?? "";
  return input.settings.modules.some((candidate) => candidate.key === module)
    ? `bdk config schema ${module}`
    : "bdk config schema";
}

/** A path below the project root relative to it; any other path as is. */
export function displayPath(input: ConfigInput, path: string): string {
  const root = `${input.projectRoot}/`;
  return path.startsWith(root) ? path.slice(root.length) : path;
}

export function isRefusal(outcome: object): outcome is Refusal {
  return "refused" in outcome;
}
