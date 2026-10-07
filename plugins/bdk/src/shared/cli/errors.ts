// Errors of the bdk CLI and the exit code of each class (spec `bdk-cli`, "Errors", "Exit codes").

export type ErrorClass = "usage" | "env" | "internal";
export type ErrorCode = `${ErrorClass}/${string}`;

export const EXIT = { ok: 0, no: 1, usage: 2, env: 3, internal: 4 } as const;

/** An error a command reports to the caller; anything else that escapes is `internal/unexpected`. */
export class CliError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | undefined;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = hint;
  }

  get exit(): number {
    return EXIT[this.code.slice(0, this.code.indexOf("/")) as ErrorClass];
  }
}
