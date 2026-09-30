// What `rules show` reports (`kernel-cli/rules`): one rule by id, or the rules
// a ticket's active package records, in its order, with the truncation count
// and the `rules-read` stamp.
import type { LoadedRule } from "./rule.ts";

interface ShownRule {
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
  readonly role: string;
  readonly target: string;
  readonly rules: readonly ShownRule[];
  /** The package's `rules-truncated`. */
  readonly truncated: number;
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

export type RulesShow = TicketRules | OneRule;
