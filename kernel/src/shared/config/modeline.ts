// The yaml-language-server modeline and the offline schema copy (`kernel-settings`,
// Settings JSON Schema; design D-12). The URL names the plugin version's tag, so a
// settings file keeps validating against the schema of the kernel that wrote it.
import { settingsJsonSchema } from "./json-schema.ts";
import type { ConfigRegistry } from "./registry.ts";

const MODELINE_PREFIX = "# yaml-language-server: $schema=";

export const OFFLINE_SCHEMA_PATH = ".bdk/.machine/schema/settings.json";

export function settingsSchemaUrl(version: string): string {
  return `https://raw.githubusercontent.com/broneq/bdk/v${version}/schema/settings.json`;
}

export function modeline(version: string): string {
  return `${MODELINE_PREFIX}${settingsSchemaUrl(version)}`;
}

/** The schema URL of the file's first-line modeline, or undefined without one. */
export function modelineUrl(text: string): string | undefined {
  const first = text.split("\n", 1)[0] ?? "";
  return first.startsWith(MODELINE_PREFIX) ? first.slice(MODELINE_PREFIX.length).trim() : undefined;
}

/** `text` with its modeline set to `version`: replaced when present, else added as the first line. */
export function withModeline(text: string, version: string): string {
  const line = modeline(version);
  if (modelineUrl(text) === undefined) return text === "" ? `${line}\n` : `${line}\n${text}`;
  const newline = text.indexOf("\n");
  return newline === -1 ? `${line}\n` : `${line}${text.slice(newline)}`;
}

/** The content of the offline copy: the running kernel's settings schema. */
export function offlineSchemaText(registry: ConfigRegistry): string {
  return `${JSON.stringify(settingsJsonSchema(registry), null, 2)}\n`;
}
