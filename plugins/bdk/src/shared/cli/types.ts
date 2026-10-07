// The declaration a slice's `index.ts` exports for its command group (design D8).

export interface Argument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface Flag {
  readonly type: "boolean" | "string";
  readonly description: string;
}

export interface Input {
  readonly args: Readonly<Record<string, string | undefined>>;
  readonly flags: Readonly<Record<string, string | boolean | undefined>>;
}

/** What a command returns: `data` for `--json`, `text` otherwise; exit 1 when the answer is no. */
export interface Result {
  readonly data: unknown;
  readonly text: string;
  readonly exit?: 1;
}

export interface Command {
  /** Absent only for the one command of a group that has a single command. */
  readonly verb?: string;
  readonly summary: string;
  readonly arguments?: readonly Argument[];
  readonly flags?: Readonly<Record<string, Flag>>;
  /** The exit codes the command returns besides 0, 2, 3 and 4. */
  readonly exits?: readonly { readonly code: 1; readonly when: string }[];
  run(input: Input): Result | Promise<Result>;
}

export interface Group {
  readonly name: string;
  readonly summary: string;
  readonly commands: readonly Command[];
}
