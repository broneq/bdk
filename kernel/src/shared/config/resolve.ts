// One resolution of the configuration: read the file layers, merge them,
// validate against the registry and resolve the prompt values. Every command
// that needs settings goes through here.
import type { Store } from "../store/index.ts";
import { readLayers } from "./layers.ts";
import type { Layer } from "./layers.ts";
import { mergeLayers } from "./merge.ts";
import type { Merged } from "./merge.ts";
import type { ConfigProblem } from "./problems.ts";
import { resolvePrompts } from "./prompts.ts";
import type { Prompts } from "./prompts.ts";
import type { ConfigRegistry } from "./registry.ts";
import { validateLayers } from "./validate.ts";
import type { Mapping } from "./values.ts";

export interface ConfigContext {
  readonly store: Store;
  readonly registry: ConfigRegistry;
  readonly globalDir: string;
  readonly projectRoot: string;
  readonly pluginRoot: string;
}

export interface Resolution {
  readonly layers: readonly Layer[];
  readonly merged: Merged;
  /** The validated configuration with defaults; absent when there are problems. */
  readonly value?: Mapping;
  readonly prompts: Prompts;
  readonly problems: readonly ConfigProblem[];
}

/** Throws a KernelRefusal only for a file that is not YAML; everything else is a problem. */
export function resolveConfig(context: ConfigContext): Resolution {
  const layers = readLayers(context.store, context);
  const merged = mergeLayers(layers);
  const validated = validateLayers(context.registry, layers, merged);
  const prompts = resolvePrompts({ ...context, layers });
  const problems = [...validated.problems, ...prompts.problems];
  const base = { layers, merged, prompts, problems };
  return validated.value === undefined || problems.length > 0
    ? base
    : { ...base, value: validated.value };
}
