// What `rules show` reports (`kernel-cli/rules`): one rule by id, the rules
// a ticket's active package records, in its order, with the `rules-read`
// stamp, or the rules selected for a role and a file set (T42).
import type { LoadedRule } from "./rule.ts";

export interface ShownRule {
  readonly id: string;
  readonly kind: LoadedRule["kind"];
  readonly severity: LoadedRule["severity"];
  readonly applies?: readonly string[] | undefined;
  /** The glob that matched a file of the target; null for a global rule or no file set. */
  readonly matchedBy: string | null;
  readonly text: string;
}

export interface TicketRules {
  readonly ticket: string;
  /** Only for a `<ticket>@<group>` reference. */
  readonly group?: string | undefined;
  readonly role: string;
  readonly target: string;
  readonly rules: readonly ShownRule[];
  /** Absent until an implementer of the ticket read its rules. */
  readonly rulesRead?: string | undefined;
}

export interface OneRule {
  readonly id: string;
  readonly scope: LoadedRule["scope"];
  readonly file: string;
  readonly kind: LoadedRule["kind"];
  readonly severity: LoadedRule["severity"];
  readonly applies?: readonly string[] | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly origin: string;
  readonly evidence?: readonly string[] | undefined;
  readonly since: string;
  readonly source?: string | undefined;
  readonly verified?: string | undefined;
  readonly removed?: string | undefined;
  readonly disabled: boolean;
  readonly text: string;
}

/** The Selection for a role and a file set, with no Change (T42). */
export interface RoleRules {
  readonly role: string;
  readonly files: readonly string[];
  readonly rules: readonly ShownRule[];
}

export type RulesShow = TicketRules | OneRule | RoleRules;

export interface CheckReport {
  readonly valid: true;
  readonly rules: number;
  readonly bundle: number;
  readonly project: number;
  readonly tombstones: number;
}

interface ExplainedRule {
  readonly id: string;
  /** The glob that matched the file; null for a global rule. */
  readonly matchedBy: string | null;
  readonly kind: LoadedRule["kind"];
}

export interface ExplainReport {
  readonly file: string;
  readonly role: string;
  readonly rules: readonly ExplainedRule[];
  /** Rules the role would read for the file that `rules.disabled` switches off. */
  readonly disabled: readonly string[];
}

export interface PruneItem {
  readonly id: string;
  readonly reason: "no-match" | "uncited";
  readonly detail: string;
}

export interface AcceptReport {
  readonly id: string;
  /** Relative to the project root. */
  readonly path: string;
  readonly origin: string;
}

export interface RecurringItem {
  readonly fingerprint: string;
  readonly summary: string;
  readonly changes: number;
  readonly occurrences: number;
  readonly changeIds: readonly string[];
}

export interface AuditItem {
  /** `<changeId>/<entry id>` for an entry, `<changeId>/<ticket>` for an attempt finding. */
  readonly id: string;
  readonly source: "entry" | "attempt";
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  readonly applies?: readonly string[] | undefined;
  readonly evidence?: readonly string[] | undefined;
  readonly at: string;
  /** True when a rule's `origin` or `evidence` names the item. */
  readonly adopted: boolean;
}

interface Citation {
  readonly id: string;
  readonly entries: number;
  readonly changes: number;
}

export interface StatsReport {
  readonly minChanges: number;
  readonly recurring: readonly RecurringItem[];
  readonly entries?:
    | { readonly items: readonly AuditItem[]; readonly total: number; readonly truncated: boolean }
    | undefined;
  readonly citations: readonly Citation[];
}
