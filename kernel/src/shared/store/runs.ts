// The run marker (`kernel-state`, Run marker): one file per session under
// `.bdk/.machine/runs/`, never committed. A marker that does not parse is
// absent, so the stage-skill guard denies rather than admits.
import { join } from "node:path";

import type { Store } from "./store.ts";

/** The `session_id` shapes a marker file may be named after. */
export const SESSION_ID = /^[A-Za-z0-9_-]+$/;

export interface RunMarker {
  readonly schema: 1;
  readonly session: string;
  /** The typed command line, stored as `command` of the run's policy transitions. */
  readonly prompt: string;
  /** True when `--auto` was the first argument token. */
  readonly auto: boolean;
  readonly at: string;
  /** True once the run's `bdk:change` call was admitted. */
  readonly "change-started": boolean;
}

export function runMarkerPath(projectRoot: string, session: string): string {
  return join(projectRoot, ".bdk", ".machine", "runs", `${session}.json`);
}

export function readRunMarker(
  store: Store,
  projectRoot: string,
  session: string,
): RunMarker | undefined {
  if (!SESSION_ID.test(session)) return undefined;
  const text = store.read(runMarkerPath(projectRoot, session));
  if (text === undefined) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  return isRunMarker(value) && value.session === session ? value : undefined;
}

export function writeRunMarker(store: Store, projectRoot: string, marker: RunMarker): void {
  if (!SESSION_ID.test(marker.session)) {
    throw new Error(`run marker for an unchecked session id: ${marker.session}`);
  }
  store.write(runMarkerPath(projectRoot, marker.session), `${JSON.stringify(marker, null, 2)}\n`);
}

export function removeRunMarker(store: Store, projectRoot: string, session: string): void {
  if (SESSION_ID.test(session)) store.remove(runMarkerPath(projectRoot, session));
}

function isRunMarker(value: unknown): value is RunMarker {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    data.schema === 1 &&
    typeof data.session === "string" &&
    typeof data.prompt === "string" &&
    typeof data.auto === "boolean" &&
    typeof data.at === "string" &&
    typeof data["change-started"] === "boolean"
  );
}
