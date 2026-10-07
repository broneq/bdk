// What `bdk check run` answers (`schema/cli/output/check-run.json`; #166).

export type CheckVerdict = "pass" | "fail" | "not-run";

export interface CheckItem {
  readonly kind: string;
  readonly tool: string;
  readonly command: string;
  readonly exit?: number | undefined;
  /** Seconds after which the kernel killed the command. */
  readonly timeout?: number | undefined;
  /** The entry's `when`, for an entry `--skip` left out. */
  readonly skipped?: string | undefined;
  readonly verdict: CheckVerdict;
  /** The output file, relative to the project root. */
  readonly file: string;
  /** The last lines of a failing check's output. */
  readonly tail?: readonly string[] | undefined;
}

export interface CheckRunReport {
  readonly target: string;
  readonly ticket: string;
  readonly verdict: CheckVerdict;
  readonly checks: readonly CheckItem[];
  /** The manifest id per kind. */
  readonly evidence: Readonly<Record<string, string>>;
  readonly diff: {
    readonly declared: readonly string[];
    readonly touched: readonly string[];
    readonly undeclared: readonly string[];
  };
  readonly commit?: { readonly paths: readonly string[]; readonly command: string } | undefined;
}

/**
 * The verdict of one kind (`kernel-cli/check`, step 5): a failing or killed
 * command fails it; else a kind that ran nothing or met a missing tool did not
 * run; else it passed.
 */
export function kindVerdict(checks: readonly CheckItem[]): CheckVerdict {
  if (checks.some((check) => check.verdict === "fail")) return "fail";
  if (checks.length === 0 || checks.some((check) => check.verdict === "not-run")) {
    return "not-run";
  }
  return "pass";
}

/** `fail` when any kind failed, `not-run` when none passed or failed, else `pass`. */
export function overallVerdict(kinds: readonly CheckVerdict[]): CheckVerdict {
  if (kinds.includes("fail")) return "fail";
  return kinds.includes("pass") ? "pass" : "not-run";
}

/** A word for `sh`: bare when it holds only safe characters, else single-quoted. */
function shellWord(word: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

/**
 * The command that commits `paths` with the BDK trailers (`kernel-loops`,
 * Progress from git): `git add` first, so a new file enters the commit, then a
 * pathspec commit, so nothing else staged goes with it.
 */
export function commitCommand(input: {
  readonly paths: readonly string[];
  readonly subject: string;
  readonly trailers: Readonly<Record<string, string>>;
  readonly workdir?: string | undefined;
}): string {
  const paths = input.paths.map(shellWord).join(" ");
  const trailers = Object.entries(input.trailers)
    .map(([key, value]) => `--trailer ${shellWord(`${key}: ${value}`)}`)
    .join(" ");
  const commit = `git add -- ${paths} && git commit -m ${shellWord(input.subject)} ${trailers} -- ${paths}`;
  return input.workdir === undefined ? commit : `cd ${shellWord(input.workdir)} && ${commit}`;
}
