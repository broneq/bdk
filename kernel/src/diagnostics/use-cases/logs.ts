// The files under `.bdk/.machine/logs/` (`kernel-state`, Verbose log): each at
// most 20 MiB, the oldest half of its lines dropped past it, and only the 20
// newest files by modification time kept.
import { join } from "node:path";

import { halveTelemetry } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";

const LOG_LIMIT_BYTES = 20 * 1024 * 1024;
const LOG_FILES_KEPT = 20;

function logsDir(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "logs");
}

/** The file name of a session's log or analysis: `<change>-<session>` or `<session>`. */
export function sessionFileName(change: string | null, session: string): string {
  return change === null ? session : `${change}-${session}`;
}

/** Writes a whole log file, replacing an earlier one, then prunes the directory. */
export function writeLogFile(
  store: Store,
  projectRoot: string,
  name: string,
  lines: readonly string[],
  limit = LOG_LIMIT_BYTES,
): { readonly path: string; readonly lines: number } {
  let kept = [...lines];
  while (kept.length > 1 && Buffer.byteLength(`${kept.join("\n")}\n`) > limit) {
    kept = kept.slice(Math.floor(kept.length / 2));
  }
  const path = join(logsDir(projectRoot), name);
  store.write(path, `${kept.join("\n")}\n`);
  pruneLogs(store, projectRoot);
  return { path, lines: kept.length };
}

/** Keeps the newest files of the logs directory. */
function pruneLogs(store: Store, projectRoot: string, kept = LOG_FILES_KEPT): void {
  const dir = logsDir(projectRoot);
  const files = store
    .list(dir)
    .filter((name) => !name.endsWith("/"))
    .map((name) => ({ path: join(dir, name), mtime: store.stat(join(dir, name))?.mtimeMs ?? 0 }))
    .sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
  for (const file of files.slice(kept)) store.remove(file.path);
}

/**
 * Appends lines to `<session>.live.log`; past the limit the oldest half of its
 * lines is dropped, and a new file prunes the directory.
 */
export function appendLiveLog(
  store: Store,
  projectRoot: string,
  session: string,
  lines: readonly string[],
  limit = LOG_LIMIT_BYTES,
): void {
  const path = join(logsDir(projectRoot), `${session}.live.log`);
  const created = store.stat(path) === undefined;
  store.append(path, `${lines.join("\n")}\n`);
  if ((store.stat(path)?.size ?? 0) >= limit) halveTelemetry(store, path);
  if (created) pruneLogs(store, projectRoot);
}
