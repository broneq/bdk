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
  /** The model the host must start the agent on; only on an escalation ticket. */
  readonly model?: string | undefined;
  readonly kernelVersion: string;
  readonly templateHash: string;
  readonly report: string;
  /** Only on a grouped package (T42-A1). */
  readonly group?: string | undefined;
  readonly files?: readonly string[] | undefined;
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
