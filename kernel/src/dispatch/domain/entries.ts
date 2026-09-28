// Which ledger entries a package embeds (T23-D32, D13): every accepted
// `decision` and every `blocker` not resolved whose refs name the target, its
// part or one of the task's `Files:` in full; the other entries of those refs
// only as per-type counts next to `bdk log list --for <target>`.

/** The fields of an entry the selection reads. */
export interface EntryFacts {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly refs: readonly string[];
}

export interface Selection<E extends EntryFacts> {
  readonly full: readonly E[];
  readonly counted: Readonly<Record<string, number>>;
}

const CLOSED_BLOCKER = ["resolved", "superseded"];

/** `names` are the target, its part and the task's file paths; a ref's `#symbol` is ignored. */
export function selectEntries<E extends EntryFacts>(
  entries: readonly E[],
  names: readonly string[],
): Selection<E> {
  const wanted = new Set(names);
  const full: E[] = [];
  const counted: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.type === "transition") continue;
    if (!entry.refs.some((ref) => wanted.has(ref.split("#")[0] ?? ref))) continue;
    if (inFull(entry)) full.push(entry);
    else counted[entry.type] = (counted[entry.type] ?? 0) + 1;
  }
  return { full, counted };
}

function inFull(entry: EntryFacts): boolean {
  if (entry.type === "decision") return entry.status === "accepted";
  return entry.type === "blocker" && !CLOSED_BLOCKER.includes(entry.status);
}

/** The section of a plan part body from `## <task>` to the next `## ` heading. */
export function taskText(body: string, task: string): string | undefined {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `## ${task}` || line.startsWith(`## ${task} `));
  if (start === -1) return undefined;
  const end = lines.findIndex((line, at) => at > start && line.startsWith("## "));
  return lines
    .slice(start, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}
