// What `bdk commit` answers (`schema/cli/output/commit.json`): a task commit,
// or the review fix committed under a `review-fix` ticket (T42).

export interface TaskCommitReport {
  readonly task: string;
  /** Abbreviated. */
  readonly commit: string;
  readonly trailers: {
    readonly "BDK-Change": string;
    readonly "BDK-Part": string;
    readonly "BDK-Task": string;
  };
  /** Every path the commit holds, relative to the project root. */
  readonly files: readonly string[];
  readonly undeclared?: readonly string[] | undefined;
  /** The kernel finding naming the undeclared files. */
  readonly finding?: string | undefined;
}

export interface ReviewFixReport {
  /** The open `review-fix` ticket the fix was made under. */
  readonly ticket: string;
  /** Abbreviated. */
  readonly commit: string;
  readonly trailers: {
    readonly "BDK-Change": string;
    readonly "BDK-Ticket": string;
  };
  /** Every path the commit holds, relative to the project root. */
  readonly files: readonly string[];
}

export type CommitReport = TaskCommitReport | ReviewFixReport;

/** The subject, a blank line and the trailer block `rebuild` and `part done` read. */
export function commitMessage(subject: string, trailers: CommitReport["trailers"]): string {
  return `${subject}\n\n${Object.entries(trailers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}`;
}
