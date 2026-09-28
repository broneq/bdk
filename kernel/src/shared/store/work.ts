// The committed work of a Change as files: its plan parts with their tasks
// and its attempt records (`kernel-state`, Plan part and plan index; Attempt
// record). The part, attempt, commit, graph and service code read them here,
// never through the index, so a fresh clone answers the same way.
import { join } from "node:path";

import { readDocument } from "./state/documents.ts";
import type { AttemptRecord } from "./state/attempt.ts";
import { parsePlanTasks } from "./state/plan.ts";
import type { PlanTask } from "./state/plan.ts";
import type { Store } from "./store.ts";

const PART_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export interface PlanPartFrontmatter {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly "success-measure": string;
  readonly "do-not-touch": readonly string[];
  readonly "depends-on": readonly string[];
  /** Absent means `none` in `tiny` and `small` (T30). */
  readonly "spec-impact"?: "none" | readonly string[] | undefined;
}

export interface PlanPartFile {
  readonly id: string;
  /** Relative to the Change directory, e.g. `plan/parts/02-login.md`. */
  readonly file: string;
  readonly path: string;
  readonly bytes: number;
  readonly data: PlanPartFrontmatter;
  readonly body: string;
  readonly tasks: readonly PlanTask[];
  /** Grammar problems of the body (`parsePlanTasks`). */
  readonly problems: readonly string[];
}

/** The plan parts of a Change in id order; an invalid part refuses as `readDocument` does. */
export function readPlanParts(store: Store, changeDir: string): PlanPartFile[] {
  const dir = join(changeDir, "plan", "parts");
  const parts: PlanPartFile[] = [];
  for (const name of store.list(dir).sort()) {
    const id = PART_FILE.exec(name)?.[1];
    if (id === undefined) continue;
    const path = join(dir, name);
    const document = readDocument(store, path);
    if (document === undefined || !("data" in document)) continue;
    const { tasks, problems } = parsePlanTasks(document.body);
    parts.push({
      id,
      file: `plan/parts/${name}`,
      path,
      bytes: Buffer.byteLength(store.read(path) ?? ""),
      data: document.data as unknown as PlanPartFrontmatter,
      body: document.body,
      tasks,
      problems,
    });
  }
  return parts;
}

/** The part holding a task, by task id. */
export function taskHolders(parts: readonly PlanPartFile[]): Map<string, PlanPartFile> {
  const holders = new Map<string, PlanPartFile>();
  for (const part of parts) for (const task of part.tasks) holders.set(task.id, part);
  return holders;
}

export interface AttemptFile {
  readonly path: string;
  readonly data: AttemptRecord;
  readonly body: string;
}

/** The attempt records of a Change, oldest first by `opened-at`, then ticket. */
export function readAttempts(store: Store, changeDir: string): AttemptFile[] {
  const dir = join(changeDir, "attempts");
  const records: AttemptFile[] = [];
  for (const name of store.list(dir)) {
    if (name.endsWith("/")) continue;
    const path = join(dir, name);
    const document = readDocument(store, path);
    if (document === undefined || !("data" in document)) continue;
    records.push({ path, data: document.data as unknown as AttemptRecord, body: document.body });
  }
  return records.sort(
    (a, b) =>
      compare(a.data["opened-at"], b.data["opened-at"]) || compare(a.data.ticket, b.data.ticket),
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
