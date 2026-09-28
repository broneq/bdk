// What `bdk commit` answers (`schema/cli/output/commit.json`).

export interface CommitReport {
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

/** The subject, a blank line and the trailer block `rebuild` and `part done` read. */
export function commitMessage(subject: string, trailers: CommitReport["trailers"]): string {
  return `${subject}\n\n${Object.entries(trailers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}`;
}
