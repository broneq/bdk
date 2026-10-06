// The kernel-owned `.bdk/.prettierrc` (`kernel-state`, Formatter guard; #140).
// Prettier resolves the nearest configuration file of each file it formats and
// never reads a `.prettierignore` below its working directory, so this file is
// what keeps Prettier off `.bdk/`, whatever options the project sets: with
// `requirePragma` it skips every file without an `@format` pragma. JSON has no
// pragma support, so Prettier would still format an evidence capture; the
// override hands every file to the YAML parser, which has one.
import { join } from "node:path";

import { parse } from "yaml";

import type { Store } from "./store.ts";

/** Prettier's own JSON formatting, so a Prettier run that reaches it changes nothing. */
export const FORMATTER_GUARD =
  '{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }\n';

export type FormatterGuardState = "ok" | "missing" | "weak";

function guardPath(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".prettierrc");
}

/** Writes the guard when absent and returns whether it wrote; an existing file is never changed. */
export function ensureFormatterGuard(store: Store, projectRoot: string): boolean {
  const path = guardPath(projectRoot);
  if (store.read(path) !== undefined) return false;
  store.write(path, FORMATTER_GUARD);
  return true;
}

/**
 * `weak`: the file exists but does not set `requirePragma: true` with an
 * override that gives the files `*` the `yaml` parser (YAML reads JSON too).
 */
export function formatterGuardState(store: Store, projectRoot: string): FormatterGuardState {
  const text = store.read(guardPath(projectRoot));
  if (text === undefined) return "missing";
  let config: unknown;
  try {
    config = parse(text);
  } catch {
    return "weak";
  }
  const guard = mapping(config);
  if (guard?.requirePragma !== true || !Array.isArray(guard.overrides)) return "weak";
  const routed = guard.overrides.some((override) => {
    const entry = mapping(override);
    const files = entry?.files;
    const every = files === "*" || (Array.isArray(files) && files.includes("*"));
    return every && mapping(entry?.options)?.parser === "yaml";
  });
  return routed ? "ok" : "weak";
}

function mapping(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
