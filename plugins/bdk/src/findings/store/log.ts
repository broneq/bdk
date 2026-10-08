// The findings log on disk (design D3): read whole, appended one event line per write.
import { dirname, join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";
import { toLine } from "../domain/events.ts";
import type { Event } from "../domain/events.ts";

/** The log text, "" when the file does not exist, undefined when its directory does not. */
export function readLog(files: Files, log: string): string | undefined {
  const text = files.readText(log);
  if (text !== undefined) return text;
  return files.list(dirname(log)) === undefined ? undefined : "";
}

export function appendEvent(files: Files, log: string, event: Event): void {
  files.appendText(log, toLine(event));
}

/** Writes `review.md` next to the log, replacing an earlier one; returns its path. */
export function writeReport(files: Files, log: string, text: string): string {
  const path = join(dirname(log), "review.md");
  files.writeText(path, text);
  return path;
}
