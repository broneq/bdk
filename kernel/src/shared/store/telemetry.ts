// Local telemetry lines under `.bdk/.machine/telemetry/` (never committed).
// Each file stays below a size limit by dropping its oldest half, so a
// long-lived checkout never grows it without bound.
import { join } from "node:path";

import type { Store } from "./store.ts";

export const TELEMETRY_LIMIT_BYTES = 256 * 1024;

export function telemetryPath(projectRoot: string, name: string): string {
  return join(projectRoot, ".bdk", ".machine", "telemetry", `${name}.jsonl`);
}

/** Appends one JSON line; past the limit, keeps only the newest half of the lines. */
export function appendTelemetry(
  store: Store,
  projectRoot: string,
  name: string,
  record: Readonly<Record<string, unknown>>,
  limit = TELEMETRY_LIMIT_BYTES,
): void {
  const path = telemetryPath(projectRoot, name);
  store.append(path, `${JSON.stringify(record)}\n`);
  const size = store.stat(path)?.size ?? 0;
  if (size < limit) return;
  halveTelemetry(store, path);
}

/** Keeps only the newest half of the file's lines, replacing it in one step. */
export function halveTelemetry(store: Store, path: string): void {
  const lines = (store.read(path) ?? "").split("\n").filter((line) => line !== "");
  store.write(path, `${lines.slice(Math.ceil(lines.length / 2)).join("\n")}\n`);
}
