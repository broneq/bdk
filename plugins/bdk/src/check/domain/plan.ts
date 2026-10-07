// Which commands a check run runs and how each command line is composed (spec `bdk-cli/check`,
// "Run the checks"; design D4 of v3-183-check-run).

export const KINDS = ["test", "lint", "build"] as const;
export type Kind = (typeof KINDS)[number];

/** Seconds a command may run when its entry sets no `timeout`. */
export const DEFAULT_TIMEOUT = 600;

/** A `tools.<kind>` item of the resolved configuration. */
export interface Entry {
  readonly id: string;
  readonly command: string;
  readonly scoped?: string | undefined;
  readonly timeout?: number | undefined;
}

export type Tools = Readonly<Record<Kind, readonly Entry[]>>;

export interface Planned {
  readonly kind: Kind;
  readonly tool: string;
  readonly command: string;
  readonly scoped: boolean;
  readonly timeout: number;
}

const PLAIN = /^[A-Za-z0-9_./@%+=:,-]+$/;

/** The scope paths deduplicated and sorted by code unit; null without paths. */
export function scopeOf(paths: readonly string[] | undefined): readonly string[] | null {
  if (paths === undefined || paths.length === 0) return null;
  return [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A path as one word of a POSIX shell command line. */
export function quote(path: string): string {
  return PLAIN.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`;
}

/** The checks to run, in kind order and, inside a kind, in the order the entries resolve. */
// The replacement is a function, so a `$&` or `$'` in a path stays literal.
export function planChecks(
  tools: Tools,
  kinds: readonly Kind[] | undefined,
  scope: readonly string[] | null,
): readonly Planned[] {
  const files = scope?.map(quote).join(" ");
  return KINDS.filter((kind) => kinds === undefined || kinds.includes(kind)).flatMap((kind) =>
    tools[kind].map((entry): Planned => {
      const variant =
        files === undefined ? undefined : entry.scoped?.replaceAll("{files}", () => files);
      return {
        kind,
        tool: entry.id,
        command: variant ?? entry.command,
        scoped: variant !== undefined,
        timeout: entry.timeout ?? DEFAULT_TIMEOUT,
      };
    }),
  );
}
