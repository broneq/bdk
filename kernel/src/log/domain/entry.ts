// Ledger views and rules (`kernel-cli/log`; `kernel-state`, Ledger entry,
// Ledger deduplication, Derived state and mutation). Pure: the use cases
// read the files and the index, these functions decide.

/** The fields of an indexed entry these rules read (`shared/store` EntryRow has them all). */
export interface EntryRecord {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly at: string;
  readonly refs: readonly string[];
  readonly review: boolean;
  readonly ticket?: string | undefined;
  readonly category?: string | undefined;
  readonly supersedes?: string | undefined;
  readonly supersededBy?: string | undefined;
  readonly fingerprint?: string | undefined;
}

/** An entry as `log add` and `log show` print it: the frontmatter in camelCase, status derived. */
export interface EntryView {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly author: string;
  readonly at: string;
  readonly refs: readonly string[];
  readonly review: boolean;
  readonly ticket?: string | undefined;
  readonly supersedes?: string | undefined;
  readonly fingerprint?: string | undefined;
  readonly severity?: string | undefined;
  readonly category?: string | undefined;
  readonly options?: readonly string[] | undefined;
  readonly park?: boolean | undefined;
  readonly profile?: string | undefined;
  readonly evidence?: readonly string[] | undefined;
  readonly applies?: readonly string[] | undefined;
  readonly report?: string | undefined;
  readonly to?: string | undefined;
  readonly gate?: string | undefined;
  readonly session?: string | undefined;
  readonly command?: string | undefined;
  readonly skipVerify?: boolean | undefined;
  readonly auto?: boolean | undefined;
}

/** A `log list` item: summaries only, never bodies. */
export interface EntrySummary {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly at: string;
  readonly refs: readonly string[];
  readonly review?: true | undefined;
  readonly ticket?: string | undefined;
  readonly category?: string | undefined;
  readonly supersedes?: string | undefined;
  readonly supersededBy?: string | undefined;
}

type Data = Readonly<Record<string, unknown>>;

/** Optional frontmatter keys in output order, with their camelCase names. */
const OPTIONAL: readonly (readonly [string, keyof EntryView])[] = [
  ["ticket", "ticket"],
  ["supersedes", "supersedes"],
  ["fingerprint", "fingerprint"],
  ["severity", "severity"],
  ["category", "category"],
  ["options", "options"],
  ["park", "park"],
  ["profile", "profile"],
  ["evidence", "evidence"],
  ["applies", "applies"],
  ["report", "report"],
  ["to", "to"],
  ["gate", "gate"],
  ["session", "session"],
  ["command", "command"],
  ["skip-verify", "skipVerify"],
  ["auto", "auto"],
];

export function entryView(data: Data, status: string): EntryView {
  const view: Record<string, unknown> = {
    id: data.id,
    type: data.type,
    summary: data.summary,
    status,
    source: data.source,
    author: data.author,
    at: data.at,
    refs: data.refs,
    review: data.review === true,
  };
  for (const [key, name] of OPTIONAL) {
    if (data[key] !== undefined) view[name] = data[key];
  }
  return view as unknown as EntryView;
}

export function entrySummary(row: EntryRecord): EntrySummary {
  return {
    id: row.id,
    type: row.type,
    summary: row.summary,
    status: row.status,
    source: row.source,
    at: row.at,
    refs: row.refs,
    ...(row.review ? { review: true as const } : {}),
    ...(row.ticket === undefined ? {} : { ticket: row.ticket }),
    ...(row.category === undefined ? {} : { category: row.category }),
    ...(row.supersedes === undefined ? {} : { supersedes: row.supersedes }),
    ...(row.supersededBy === undefined ? {} : { supersededBy: row.supersededBy }),
  };
}

/** The part of an entry `log add` compares (`kernel-state`, Ledger deduplication). */
export interface DedupeCandidate {
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  readonly supersedes?: string | undefined;
  readonly fingerprint?: string | undefined;
  readonly ticket?: string | undefined;
}

/**
 * The existing entry equal to `draft` by its dedupe key: the fingerprint
 * against every `learning`; otherwise type, normalised summary, refs as a
 * sorted set, `supersedes` and the ticket, against live entries only. The
 * same finding under another ticket is a recurrence the oscillation check
 * counts, so it is never merged into the earlier ticket's entry.
 */
export function findDuplicate<T extends EntryRecord>(
  draft: DedupeCandidate,
  entries: readonly T[],
  normalise: (text: string) => string,
): T | undefined {
  if (draft.type === "learning") {
    return entries.find(
      (entry) => entry.type === "learning" && entry.fingerprint === draft.fingerprint,
    );
  }
  const key = (entry: DedupeCandidate): string =>
    JSON.stringify([
      entry.type,
      normalise(entry.summary),
      [...new Set(entry.refs)].sort(),
      entry.supersedes ?? "",
      entry.ticket ?? "",
    ]);
  const wanted = key(draft);
  return entries.find(
    (entry) =>
      entry.type === draft.type &&
      (entry.status === "proposed" || entry.status === "accepted") &&
      key(entry) === wanted,
  );
}

/** The moves `log resolve` allows from a derived status; empty when none. */
export function allowedMoves(type: string, status: string): readonly string[] {
  if (type === "transition") return [];
  if (status === "proposed") return ["accepted", "resolved", "superseded"];
  if (status === "accepted") return ["resolved", "superseded"];
  return [];
}

/** The body with the resolution line appended (`kernel-cli/log`, bdk log resolve). */
export function withResolution(
  body: string,
  status: string,
  at: string,
  reason: string | undefined,
): string {
  const line = `Resolved as ${status} at ${at}${reason === undefined ? "" : `: ${reason}`}\n`;
  const kept = body.replace(/\s+$/, "");
  return kept === "" ? line : `${kept}\n\n${line}`;
}

export interface AppendResult {
  readonly entry: EntryView;
  /** Relative to the project root. */
  readonly path: string;
  readonly deduplicated: boolean;
}

/** `log add`: the append result and, for a P8 downgrade, the original type and category. */
export interface AddResult extends AppendResult {
  readonly downgraded?: { readonly type: "blocker"; readonly category: string | null } | undefined;
}

/** `log ingest`: the stored report and whether it replaced an earlier one. */
export interface IngestReport {
  readonly ticket: string;
  readonly role: string;
  /** The package's `report` path, from the project root. */
  readonly path: string;
  readonly status: "done" | "done-with-concerns" | "needs-context" | "blocked";
  readonly entries: readonly string[];
  readonly replaced: boolean;
}

export interface ShownEntry {
  readonly entry: EntryView & { readonly body: string; readonly path: string };
  readonly supersededBy?: string | undefined;
}

export interface ResolveResult {
  readonly entry: string;
  readonly status: string;
  readonly by?: string | undefined;
  readonly record: string;
  readonly reason?: string | undefined;
}
