// `bdk rules stats` (`kernel-cli/rules`; design D-6 of v3-t31): the audit
// view over every Change the index holds, archived ones included. Recurring
// fingerprints across distinct Changes, the raw items the audit skill groups
// by meaning, and citations by rule id. Nothing is proposed or written.
import { listPage } from "../../shared/output/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import {
  listAllEntries,
  listAttemptFindings,
  refreshAll,
  withIndex,
} from "../../shared/store/index.ts";
import type { AttemptFindingRow, EntryRow } from "../../shared/store/index.ts";
import type { AuditItem, RecurringItem, StatsReport } from "../domain/report.ts";
import { citationsOf } from "./citations.ts";
import type { RulesDeps } from "./deps.ts";
import { loadContext } from "./settings.ts";

export interface StatsOptions {
  readonly minChanges?: number | undefined;
  readonly entries: boolean;
  readonly all: boolean;
}

/** The entry types the audit reads besides the attempt findings. */
const AUDITED = ["learning", "finding", "blocker"] as const;

export async function ruleStats(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  options: StatsOptions,
): Promise<StatsReport | Refusal> {
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const minChanges = options.minChanges ?? context.minChanges;
  return withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshAll(index);
    const entries = listAllEntries(index);
    const audited = entries.filter((entry) => (AUDITED as readonly string[]).includes(entry.type));
    const findings = listAttemptFindings(index);
    const adopted = new Set(
      context.rules.flatMap((rule) => [rule.origin, ...(rule.evidence ?? [])]),
    );
    const cited = citationsOf(entries);
    const citations = context.rules
      .filter((rule) => rule.removed === undefined)
      .map((rule) => {
        const count = cited.get(rule.id);
        return { id: rule.id, entries: count?.entries ?? 0, changes: count?.changes.size ?? 0 };
      })
      .sort((a, b) => b.entries - a.entries || a.id.localeCompare(b.id));
    const items = [
      ...audited.map((entry) => entryItem(entry, adopted)),
      ...findings.map((finding) => findingItem(finding, adopted)),
    ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
    return {
      minChanges,
      recurring: recurring(
        audited.filter((entry) => entry.type === "learning"),
        findings,
        minChanges,
      ),
      ...(options.entries ? { entries: listPage(items, { all: options.all }) } : {}),
      citations,
    };
  });
}

interface Occurrence {
  readonly fingerprint: string;
  readonly changeId: string;
  readonly summary: string | undefined;
}

function recurring(
  learnings: readonly EntryRow[],
  findings: readonly AttemptFindingRow[],
  minChanges: number,
): RecurringItem[] {
  const occurrences: Occurrence[] = [
    ...learnings.flatMap((entry) =>
      entry.fingerprint === undefined
        ? []
        : [{ fingerprint: entry.fingerprint, changeId: entry.changeId, summary: entry.summary }],
    ),
    ...findings.map((finding) => ({
      fingerprint: finding.fingerprint,
      changeId: finding.changeId,
      summary: undefined,
    })),
  ];
  const groups = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    groups.set(occurrence.fingerprint, [...(groups.get(occurrence.fingerprint) ?? []), occurrence]);
  }
  return [...groups.entries()]
    .map(([fingerprint, group]) => {
      const changeIds = [...new Set(group.map((occurrence) => occurrence.changeId))].sort();
      const finding = findings.find((row) => row.fingerprint === fingerprint);
      return {
        fingerprint,
        summary:
          group.find((occurrence) => occurrence.summary !== undefined)?.summary ??
          (finding === undefined ? fingerprint : findingSummary(finding)),
        changes: changeIds.length,
        occurrences: group.length,
        changeIds,
      };
    })
    .filter((item) => item.changes >= minChanges)
    .sort(
      (a, b) =>
        b.changes - a.changes ||
        b.occurrences - a.occurrences ||
        a.fingerprint.localeCompare(b.fingerprint),
    );
}

function entryItem(entry: EntryRow, adopted: ReadonlySet<string>): AuditItem {
  const id = `${entry.changeId}/${entry.id}`;
  return {
    id,
    source: "entry",
    type: entry.type,
    summary: entry.summary,
    refs: entry.refs,
    ...(entry.applies === undefined ? {} : { applies: entry.applies }),
    ...(entry.evidence === undefined ? {} : { evidence: entry.evidence }),
    at: entry.at,
    adopted: adopted.has(id),
  };
}

function findingItem(finding: AttemptFindingRow, adopted: ReadonlySet<string>): AuditItem {
  const id = `${finding.changeId}/${finding.ticket}`;
  return {
    id,
    source: "attempt",
    type: finding.type,
    summary: findingSummary(finding),
    refs: [location(finding)],
    at: finding.at,
    adopted: adopted.has(id),
  };
}

/** An attempt finding keeps no text: its type and location stand in for a summary. */
function findingSummary(finding: AttemptFindingRow): string {
  return `${finding.type} at ${location(finding)}`;
}

function location(finding: AttemptFindingRow): string {
  return finding.symbol === undefined ? finding.file : `${finding.file}#${finding.symbol}`;
}
