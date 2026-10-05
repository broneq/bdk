// What the report reads besides the transcripts, as plain data: the journal
// lines with their line numbers, the registry rows, the attempt records and
// the park questions of the Change, and the settings the detectors use. The
// use case reads them through `shared/store`; the domain never touches a file.
// The line shapes mirror `journalLine` (`shared/store/journal.ts`); the use
// case assigns parsed lines to them, so the compiler keeps the two in step.

interface CommandFields {
  readonly v: 1;
  readonly at: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly exit: number;
  readonly rule: string | null;
  readonly ticket: string | null;
  readonly change: string | null;
  readonly ms: number;
}

type JournalLine =
  | (CommandFields & { readonly kind: "command" })
  | (CommandFields & { readonly kind: "guard"; readonly agent: string })
  | {
      readonly v: 1;
      readonly kind: "session";
      readonly at: string;
      readonly session: string;
      readonly transcript: string | null;
      readonly source: string | null;
      readonly bdk: string;
      readonly commit: string | null;
      readonly host: string | null;
    }
  | {
      readonly v: 1;
      readonly kind: "agent-start";
      readonly at: string;
      readonly agent: string;
      readonly type: string;
      readonly parent: string | null;
      readonly ticket: string | null;
      readonly session: string | null;
    }
  | {
      readonly v: 1;
      readonly kind: "agent-stop";
      readonly at: string;
      readonly agent: string;
      readonly transcript: string | null;
      readonly by: "subagent-stop" | "agent-result" | "task-stop";
      readonly session: string | null;
    }
  | {
      readonly v: 1;
      readonly kind: "question";
      readonly at: string;
      readonly agent: string;
      readonly count: number;
      readonly session: string | null;
    };

/** One journal line and its 1-based line number in the file (`journal:<n>`). */
export type NumberedLine = JournalLine & { readonly n: number };

export type CommandLine = Extract<NumberedLine, { kind: "command" | "guard" }>;

export interface AgentFacts {
  readonly id: string;
  readonly type: string | null;
  readonly session: string | null;
  /** An agent id, `main`, or null before the parent linked it. */
  readonly parent: string | null;
  readonly ticket: string | null;
  /** The role of the agent's package, from its `role` field. */
  readonly role: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly endedBy: string | null;
}

export interface AttemptFacts {
  readonly ticket: string;
  readonly loop: string;
  readonly target: string;
  readonly attempt: number;
  readonly escalation: boolean;
  readonly openedAt: string;
  readonly closedAt: string | null;
  /** The close reason (the record's body); empty while open. */
  readonly reason: string;
}

export interface ParkFacts {
  /** The ledger id of the park question. */
  readonly id: string;
  readonly at: string;
}

export interface Thresholds {
  readonly repeatRefusal: number;
  readonly repeatRead: number;
  readonly outlierFactor: number;
}
