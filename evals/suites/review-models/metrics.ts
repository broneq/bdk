// The review-models metrics (spec skill-evals, Review models measurement): a
// seeded defect is found when an entry of the review names its file and a
// line in its range and the judge matches the entry to it; a false alarm is
// an alarm the coordinator did not triage `not-a-problem` that the judge
// matches to no defect. Pure functions over the ledger listing and the
// judge's answer, so a recorded run is measured again without a session.
import { DEFECT_CLASSES } from "./key.ts";
import type { AnswerKey, Defect } from "./key.ts";

/** One ledger entry as `bdk log list --json` and `bdk log show --json` give it. */
export interface ReviewEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  readonly level?: string;
  readonly body?: string;
}

/** The judge's answer: per defect, the ids of the entries that describe it. */
export interface Matches {
  readonly defects: readonly { readonly id: string; readonly entries: readonly string[] }[];
}

/** The entry types a reviewer writes about the code. */
export const REVIEW_TYPES = ["finding", "blocker", "observation"] as const;

/**
 * An entry that claims a defect: a finding or a blocker, or an observation the
 * coordinator raised to `blocker` or `should-fix`; never one triaged
 * `not-a-problem`.
 */
export function isAlarm(entry: ReviewEntry): boolean {
  if (entry.level === "not-a-problem") return false;
  if (entry.type === "finding" || entry.type === "blocker") return true;
  return (
    entry.type === "observation" && (entry.level === "blocker" || entry.level === "should-fix")
  );
}

/** The lines an entry names in `file`: refs `file:12`, `file:12-15`, `file#L12-L15`, and the same in its text. */
export function namedLines(entry: ReviewEntry, file: string): number[] {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}(?::|#L)(\\d+)(?:-L?(\\d+))?`, "g");
  const lines: number[] = [];
  for (const text of [...entry.refs, entry.summary, entry.body ?? ""]) {
    for (const match of text.matchAll(pattern)) {
      const first = Number(match[1]);
      const last = match[2] === undefined ? first : Number(match[2]);
      for (let line = first; line <= Math.min(last, first + 200); line += 1) lines.push(line);
    }
  }
  return lines;
}

/** Whether an entry names the defect's file and a line in its range. */
export function locates(entry: ReviewEntry, defect: Defect): boolean {
  const [first, last] = defect.lines;
  return namedLines(entry, defect.file).some((line) => line >= first && line <= last);
}

function matchedIds(matches: Matches, defect: string): ReadonlySet<string> {
  return new Set(matches.defects.find((item) => item.id === defect)?.entries ?? []);
}

/** The defects some entry finds: matched by the judge and located at the defect's lines. */
function foundBy(key: AnswerKey, entries: readonly ReviewEntry[], matches: Matches): Set<string> {
  const found = new Set<string>();
  for (const defect of key.defects) {
    const judged = matchedIds(matches, defect.id);
    if (entries.some((entry) => judged.has(entry.id) && locates(entry, defect))) {
      found.add(defect.id);
    }
  }
  return found;
}

function recall(
  key: AnswerKey,
  found: ReadonlySet<string>,
  prefix: string,
): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const kind of DEFECT_CLASSES) {
    const defects = key.defects.filter((defect) => defect.class === kind);
    if (defects.length === 0) continue;
    const hits = defects.filter((defect) => found.has(defect.id)).length;
    metrics[`${prefix}${kind}`] = hits / defects.length;
  }
  return metrics;
}

/**
 * Recall per defect class, found per defect, false alarms and the alarm count
 * of one run, before and after triage (#158): a defect counts after triage
 * only through an entry not triaged `not-a-problem`, a defect found only by
 * dismissed entries counts in `dismissed_by_triage`, and `false_alarms_raw`
 * counts every finding and blocker the judge matches to no defect, whatever
 * its level, so the triage's filtering shows as the difference.
 */
export function reviewMetrics(
  key: AnswerKey,
  entries: readonly ReviewEntry[],
  matches: Matches,
): Record<string, number> {
  const metrics: Record<string, number> = {};
  const found = foundBy(key, entries, matches);
  const kept = foundBy(
    key,
    entries.filter((entry) => entry.level !== "not-a-problem"),
    matches,
  );
  for (const defect of key.defects) metrics[`found_${defect.id}`] = found.has(defect.id) ? 1 : 0;
  Object.assign(metrics, recall(key, found, "recall_"));
  const matched = new Set(matches.defects.flatMap((item) => item.entries));
  const alarms = entries.filter(isAlarm);
  metrics.alarms = alarms.length;
  metrics.false_alarms = alarms.filter((entry) => !matched.has(entry.id)).length;
  metrics.false_alarms_raw = entries.filter(
    (entry) => (entry.type === "finding" || entry.type === "blocker") && !matched.has(entry.id),
  ).length;
  for (const defect of key.defects) {
    metrics[`found_after_triage_${defect.id}`] = kept.has(defect.id) ? 1 : 0;
  }
  Object.assign(metrics, recall(key, kept, "recall_after_triage_"));
  metrics.dismissed_by_triage = [...found].filter((id) => !kept.has(id)).length;
  return metrics;
}
