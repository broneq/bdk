// Loads `pipeline/pipeline.yaml` from the plugin root (design D-1), once per
// process for the same text. A shipped file that fails the schema or the
// cross-checks is a kernel defect: it throws, and the content test keeps that
// from ever shipping (`kernel-pipeline`, Pipeline file).
import { join } from "node:path";
import { parse } from "yaml";
import type * as z from "zod";

import type { KindRegistry } from "../domain/kinds/index.ts";
import { pipelineProblems } from "../domain/pipeline.ts";
import type { Declared, Pipeline } from "../domain/pipeline.ts";
import { pipelineSchema } from "../schema/pipeline.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";

const PIPELINE_FILE = "pipeline/pipeline.yaml";

const cache = new WeakMap<KindRegistry, Map<string, Pipeline>>();

export function loadPipeline(
  store: Store,
  pluginRoot: string,
  settings: ConfigRegistry,
  kinds: KindRegistry,
): Pipeline {
  const path = join(pluginRoot, PIPELINE_FILE);
  const text = store.read(path);
  if (text === undefined) throw new Error(`the plugin file ${PIPELINE_FILE} is missing`);
  const known = cache.get(kinds)?.get(text);
  if (known !== undefined) return known;
  const problems = pipelineErrors(text, declaredBy(settings, kinds));
  if (problems.pipeline === undefined) {
    throw new Error(`${PIPELINE_FILE} is invalid: ${problems.errors.join("; ")}`);
  }
  const byText = cache.get(kinds) ?? new Map<string, Pipeline>();
  byText.set(text, problems.pipeline);
  cache.set(kinds, byText);
  return problems.pipeline;
}

/** The schema and cross-check errors of a pipeline text, each naming its key. */
export function pipelineErrors(
  text: string,
  declared: Declared,
): { readonly pipeline?: Pipeline; readonly errors: string[] } {
  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)] };
  }
  const parsed = pipelineSchema.safeParse(data);
  if (!parsed.success) return { errors: parsed.error.issues.flatMap(issueText) };
  const errors = pipelineProblems(parsed.data, declared);
  return errors.length === 0 ? { pipeline: parsed.data, errors } : { errors };
}

/** What a pipeline may name, read from the settings registry and the kinds. */
export function declaredBy(settings: ConfigRegistry, kinds: KindRegistry): Declared {
  const below = (prefix: string): Set<string> =>
    new Set(
      settings.keys
        .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("."))
        .map((key) => key.slice(prefix.length)),
    );
  return {
    kinds: new Set(kinds.keys()),
    features: below("features."),
    gates: below("policy.gates."),
  };
}

function issueText(issue: z.core.$ZodIssue): string[] {
  const at = keyOf(issue.path);
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => `${at === "" ? key : `${at}.${key}`}: unknown key`);
  }
  return [`${at === "" ? "(root)" : at}: ${issue.message}`];
}

function keyOf(path: readonly PropertyKey[]): string {
  return path
    .map((segment, n) =>
      typeof segment === "number" ? `[${segment}]` : `${n === 0 ? "" : "."}${String(segment)}`,
    )
    .join("");
}
