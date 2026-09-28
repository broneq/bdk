// What `dispatch build` and `dispatch show` return.

export interface BuildReport {
  /** From the project root. */
  readonly path: string;
  readonly bytes: number;
  readonly ticket: string;
  readonly target: string;
  readonly role: string;
  readonly adapter: string;
  readonly scope: string;
  readonly kernelVersion: string;
  readonly templateHash: string;
  readonly report: string;
  readonly entries: {
    readonly full: readonly string[];
    readonly counted: Readonly<Record<string, number>>;
  };
}

export interface ShowReport {
  /** From the project root. */
  readonly path: string;
  readonly content: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
}
