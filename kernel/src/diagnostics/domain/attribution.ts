// Which agent ran each kernel command (design D2 of v3-t47-run-diagnostics):
// first the registry row that holds the line's ticket, then the Bash
// `tool_use` that names the same verb and arguments within 5 seconds before
// the line; otherwise `unknown`. A host hook line belongs to `host`.
import { JOURNAL_VALUE_CHARS } from "../../shared/vocabulary/index.ts";
import type { AgentFacts, CommandLine } from "./facts.ts";
import type { AgentTranscript } from "./transcript.ts";

export const UNKNOWN_AGENT = "unknown";
export const HOST_AGENT = "host";
const MATCH_WINDOW_MS = 5_000;
/** `bdk` and `node .../bdk.mjs` both end in this word before the verb. */
const KERNEL_WORD = /(^|\/)bdk(\.mjs)?$/;

/** A Bash tool use of the session, for matching. */
export interface BashUse {
  readonly agent: string;
  readonly line: number;
  readonly at: number;
  /** The simple commands of the Bash command, as words. */
  readonly commands: readonly (readonly string[])[];
}

export interface Attribution {
  readonly agent: string;
  /** The transcript use the line matched, `<agent>:<line>`. */
  readonly use: BashUse | null;
}

/** The Bash tool uses of all transcripts, with their command split into words. */
export function bashUses(agents: readonly AgentTranscript[]): BashUse[] {
  const uses: BashUse[] = [];
  for (const transcript of agents) {
    for (const event of transcript.events) {
      if (event.kind !== "tool-use" || event.name !== "Bash") continue;
      const command = (event.input as { command?: unknown } | null)?.command;
      if (typeof command !== "string") continue;
      uses.push({
        agent: transcript.agent,
        line: event.line,
        at: Date.parse(event.at),
        commands: shellCommands(command),
      });
    }
  }
  return uses;
}

/**
 * Attributes every command line. `verbOf` gives a record id's argv words;
 * each simple command of a tool use matches one line at most, the latest line
 * first, so one Bash use that calls the kernel twice serves two lines.
 */
export function attribute(
  lines: readonly CommandLine[],
  agents: readonly AgentFacts[],
  uses: readonly BashUse[],
  verbOf: (command: string) => readonly string[] | undefined,
): Map<number, Attribution> {
  const result = new Map<number, Attribution>();
  const taken = new Set<readonly string[]>();
  for (const line of [...lines].reverse()) {
    if (line.kind === "guard") {
      result.set(line.n, { agent: line.agent, use: null });
      continue;
    }
    if (line.command.startsWith("hooks-")) {
      result.set(line.n, { agent: HOST_AGENT, use: null });
      continue;
    }
    const match = matchUse(line, uses, taken, verbOf);
    if (match !== null) taken.add(match.words);
    const use = match?.use ?? null;
    const holders = line.ticket === null ? [] : agents.filter((row) => row.ticket === line.ticket);
    const holder =
      holders.find((row) => row.id === use?.agent) ??
      (holders.length > 0 ? [...holders].sort(byStart)[0] : undefined);
    result.set(line.n, { agent: holder?.id ?? use?.agent ?? UNKNOWN_AGENT, use });
  }
  return result;
}

function byStart(a: AgentFacts, b: AgentFacts): number {
  return (a.startedAt ?? "").localeCompare(b.startedAt ?? "");
}

function matchUse(
  line: CommandLine,
  uses: readonly BashUse[],
  taken: ReadonlySet<readonly string[]>,
  verbOf: (command: string) => readonly string[] | undefined,
): { readonly use: BashUse; readonly words: readonly string[] } | null {
  const verb = line.command === "unknown" ? [] : verbOf(line.command);
  if (verb === undefined) return null;
  const at = Date.parse(line.at);
  let best: { readonly use: BashUse; readonly words: readonly string[] } | null = null;
  for (const use of uses) {
    if (use.at > at || use.at < at - MATCH_WINDOW_MS) continue;
    const words = use.commands.findLast(
      (each) => !taken.has(each) && invokes(each, verb, line.args),
    );
    if (words === undefined) continue;
    if (best === null || use.at > best.use.at) best = { use, words };
  }
  return best;
}

/** True when one simple command of the Bash command calls the kernel. */
export function callsKernel(command: string): boolean {
  return shellCommands(command).some((words) => words.some((word) => KERNEL_WORD.test(word)));
}

/** True when the words call the kernel with this verb and these (journal-cut) arguments. */
export function invokes(
  words: readonly string[],
  verb: readonly string[],
  args: readonly string[],
): boolean {
  for (let index = 0; index < words.length; index += 1) {
    if (!KERNEL_WORD.test(words[index] ?? "")) continue;
    const rest = words.slice(index + 1);
    if (verb.every((word, at) => rest[at] === word) && argsMatch(rest.slice(verb.length), args)) {
      return true;
    }
  }
  return false;
}

function argsMatch(words: readonly string[], args: readonly string[]): boolean {
  for (const [index, arg] of args.entries()) {
    if (arg === "..." && index === args.length - 1) return true;
    const word = words[index];
    if (word === undefined) return false;
    const same = arg.length >= JOURNAL_VALUE_CHARS ? word.startsWith(arg) : word === arg;
    if (!same) return false;
  }
  return true;
}

/**
 * The simple commands of a Bash command as words: quotes and backslashes
 * resolved, split at `|`, `;`, `&`, `&&`, `||` and newlines. A variable an
 * earlier command assigned (`B=.../bdk.mjs; node $B next`, also with
 * `export`) is expanded, as agents often call the kernel through one; other
 * expansions stay literal, as no shell runs here.
 */
export function shellCommands(command: string): string[][] {
  const variables = new Map<string, string>();
  return splitCommands(command).map((words) => {
    const expanded = words.map((word) => expand(word, variables));
    const assignments = expanded[0] === "export" ? expanded.slice(1) : expanded;
    if (assignments.every((word) => ASSIGNMENT.test(word))) {
      for (const word of assignments) {
        const at = word.indexOf("=");
        variables.set(word.slice(0, at), word.slice(at + 1));
      }
    }
    return expanded;
  });
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const REFERENCE = /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g;

function expand(word: string, variables: ReadonlyMap<string, string>): string {
  return word.replace(
    REFERENCE,
    (whole, braced: string | undefined, plain: string | undefined) =>
      variables.get(braced ?? plain ?? "") ?? whole,
  );
}

function splitCommands(command: string): string[][] {
  const commands: string[][] = [[]];
  let word: string | null = null;
  let quote: "'" | '"' | null = null;
  const push = () => {
    if (word !== null) commands.at(-1)?.push(word);
    word = null;
  };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? "";
    if (quote !== null) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && index + 1 < command.length) {
        index += 1;
        word = (word ?? "") + (command[index] ?? "");
      } else word = (word ?? "") + char;
    } else if (char === "'" || char === '"') {
      quote = char;
      word ??= "";
    } else if (char === "\\" && index + 1 < command.length) {
      index += 1;
      if (command[index] !== "\n") word = (word ?? "") + (command[index] ?? "");
    } else if (char === " " || char === "\t") {
      push();
    } else if (char === "&" && /[<>]$/.test(word ?? "")) {
      word = (word ?? "") + char;
    } else if (char === "\n" || char === ";" || char === "|" || char === "&") {
      push();
      if ((commands.at(-1)?.length ?? 0) > 0) commands.push([]);
    } else {
      word = (word ?? "") + char;
    }
  }
  push();
  return commands.filter((words) => words.length > 0);
}
