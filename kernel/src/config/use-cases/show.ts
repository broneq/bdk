// `bdk config show`: the resolved value at a key, prompt values as their files.
import {
  declaredSteps,
  layerFiles,
  unknownKeyMessage,
  valueAt,
} from "../../shared/config/index.ts";
import type { PromptValue } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { leafOrigins } from "../domain/origins.ts";
import type { LayerEntry, ShowReport } from "../domain/report.ts";
import { displayPath, isRefusal, resolve, schemaCommand } from "./input.ts";
import type { ConfigInput, Resolved } from "./input.ts";

export interface ShowRequest {
  readonly key?: string;
  readonly origins: boolean;
}

const PROMPT_PREFIX = "prompts.";
const PROMPT_SETTINGS = new Set(["dir", "files"]);

export function showConfig(input: ConfigInput, request: ShowRequest): ShowReport | Refusal {
  const resolved = resolve(input);
  if (isRefusal(resolved)) return resolved;
  const layers = fileLayers(input);
  const { key } = request;

  if (key === undefined) {
    const value = {
      ...resolved.value,
      prompts: { ...promptSettings(resolved), ...prompts(input, resolved) },
    };
    return withOrigins({ value, layers }, request, () =>
      leafOrigins(resolved.value, "", resolved.merged.origins),
    );
  }

  const promptKey = promptKeyOf(key);
  if (promptKey !== undefined) {
    if (input.settings.promptKey(promptKey) === undefined) return unknownKey(input, key);
    const value = resolved.prompts.values.get(promptKey);
    if (value === undefined) return notFound(key);
    return { key, value: displayPrompt(input, value), layers };
  }

  const steps = declaredSteps(input.settings, key);
  if (steps === undefined) return unknownKey(input, key);
  const value = valueAt(resolved.value, steps);
  if (value === undefined) return notFound(key);
  return withOrigins({ key, value, layers }, request, () =>
    leafOrigins(value, key, resolved.merged.origins),
  );
}

function withOrigins(
  report: ShowReport,
  request: ShowRequest,
  origins: () => ShowReport["origins"],
): ShowReport {
  return request.origins ? { ...report, origins: origins() } : report;
}

/** The prompt key `prompts.<key>` names; undefined for `prompts.dir`, `prompts.files` and other keys. */
function promptKeyOf(key: string): string | undefined {
  if (!key.startsWith(PROMPT_PREFIX)) return undefined;
  const rest = key.slice(PROMPT_PREFIX.length);
  return PROMPT_SETTINGS.has(rest.split(".")[0] ?? "") ? undefined : rest;
}

function promptSettings(resolved: Resolved): Record<string, unknown> {
  const settings = resolved.value.prompts;
  return typeof settings === "object" && settings !== null ? { ...settings } : {};
}

function prompts(input: ConfigInput, resolved: Resolved): Record<string, unknown> {
  return Object.fromEntries(
    [...resolved.prompts.values].map(([key, value]) => [key, displayPrompt(input, value)]),
  );
}

function displayPrompt(input: ConfigInput, value: PromptValue): PromptValue {
  return {
    mode: value.mode,
    files: value.files.map((file) => ({ ...file, path: displayPath(input, file.path) })),
  };
}

function fileLayers(input: ConfigInput): LayerEntry[] {
  return layerFiles(input.globalDir, input.projectRoot).map(({ name, path }) => ({
    layer: name,
    path: displayPath(input, path),
    present: input.store.exists(path),
  }));
}

export function unknownKey(input: ConfigInput, key: string): Refusal {
  return refuse("policy/unknown-config-key", `${key}: ${unknownKeyMessage(input.settings, key)}`, [
    schemaCommand(input, key),
    "bdk config show",
  ]);
}

function notFound(key: string): Refusal {
  return refuse(
    "input/not-found",
    `${key} is declared, but no layer sets it and it has no default`,
    [`bdk config set ${key} <value>`, "bdk config show"],
  );
}
