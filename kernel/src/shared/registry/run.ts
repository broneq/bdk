// The pipeline of design D-5 and the mode wrapper: every call is resolved,
// helped, parsed, checked and dispatched in one order, then turned into the
// contract shape of the record's `mode` (`kernel-cli`, Output modes).
import { json, refusalText, stopBlock } from "../output/index.ts";
import type { Streams } from "../output/index.ts";
import { blockReason, exitCodeFor, isRefusal, KernelRefusal, refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import { commandHelp, globalHelp, groupHelp } from "./help.ts";
import { meetsNodeMinimum, nodeVersionRefusal } from "./node-version.ts";
import { parse } from "./parse.ts";
import type { FlagValue } from "./parse.ts";
import type { CommandIndex, CommandRecord } from "./record.ts";
import { commandLine } from "./record.ts";
import { resolve, unknownCommand } from "./resolve.ts";

/** What the kernel asks of the machine; `main.ts` binds the real one, tests a fake. */
export interface Runtime {
  readonly nodeVersion: string;
  /** The process environment, the platform and the home directory (global layer path). */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
  readonly home: string;
  /** The root of the git work tree containing `cwd`, or undefined outside one. */
  workTree(cwd: string): string | undefined;
  /** The executable `name` resolves to on `PATH`, or undefined when not installed. */
  which(name: string): string | undefined;
  /** All of stdin, read at once; only the hook handlers, whose payload the host writes first. */
  readStdin(): string;
  /**
   * A body from stdin that never waits (#166): `terminal` when stdin is a
   * terminal, `silent` when no byte arrived within the wait, else the text.
   */
  readBody(): Promise<StdinBody>;
}

export type StdinBody = { readonly text: string } | { readonly unavailable: "terminal" | "silent" };

/** The seconds a body reader waits for the first byte of stdin (`kernel-cli`, Invocation). */
export const STDIN_WAIT_SECONDS = 3;

/**
 * The body a command reads from stdin, or `input/stdin-unavailable` naming
 * `instead`, the command's file form or how to pipe the body.
 */
export async function stdinBody(
  runtime: Runtime,
  instead: readonly [string, ...string[]],
): Promise<string | Refusal> {
  const body = await runtime.readBody();
  if ("text" in body) return body.text;
  const why =
    body.unavailable === "terminal"
      ? "stdin is a terminal; this command reads its input from a pipe or a file"
      : `no input arrived on stdin within ${STDIN_WAIT_SECONDS} s`;
  return refuse("input/stdin-unavailable", why, instead);
}

/** The Change bound to the current branch (`kernel-state`, Branch binding). */
export interface ActiveChange {
  readonly id: string;
  /** Absolute path of the Change directory. */
  readonly dir: string;
  readonly projectRoot: string;
  readonly branch: string;
}

/** Resolves the active Change for a Change-scoped record; `main.ts` binds `shared/store`'s. */
export type ActiveChangeResolver = (where: {
  readonly cwd: string;
  readonly workTree: string;
}) => ActiveChange | Refusal;

/**
 * One `command` or `guard` line of the run journal (`kernel-cli`, Run journal);
 * `shared/store`'s `journalLine` is its schema.
 */
export type CommandJournalLine = {
  readonly v: 1;
  readonly at: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly exit: number;
  readonly rule: string | null;
  readonly ticket: string | null;
  readonly change: string | null;
  readonly ms: number;
} & ({ readonly kind: "command" } | { readonly kind: "guard"; readonly agent: string });

/** Where the line was produced: the sink finds the project root from it. */
export interface JournalEntry {
  readonly cwd: string;
  readonly workTree: string;
  readonly line: CommandJournalLine;
}

/** Appends a journal line; `main.ts` binds `shared/store`'s journal. */
export type JournalSink = (entry: JournalEntry) => Promise<void>;

export interface RegistryOptions {
  readonly activeChange?: ActiveChangeResolver;
  readonly journal?: JournalSink;
  /** Milliseconds since the epoch; tests fix it. */
  readonly now?: () => number;
}

interface Invocation {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly runtime: Runtime;
  readonly streams: Streams;
}

interface CommandContext {
  readonly record: CommandRecord;
  readonly positionals: Readonly<Record<string, string>>;
  /** Every value of a repeatable argument (`Parsed.lists`). */
  readonly lists: Readonly<Record<string, readonly string[]>>;
  readonly flags: Readonly<Record<string, FlagValue>>;
  readonly json: boolean;
  readonly cwd: string;
  /** Absent only for the standalone `version`. */
  readonly workTree?: string;
  /** Present for a Change-scoped record, unless its registration resolves the Change itself. */
  readonly change?: ActiveChange;
  /** Present exactly when the registration has `resolvesChange: "handler"`. */
  readonly resolveChange?: () => ActiveChange | Refusal;
  readonly runtime: Runtime;
  /** A guard handler names the payload's agent for the journal line of its block. */
  readonly noteAgent?: (agent: string) => void;
}

/** A handler's success: `data` is the `--json` object, `text` its rendering. */
interface Answer {
  readonly data: unknown;
  readonly text: string;
}

export type Handler = (context: CommandContext) => Answer | Refusal | Promise<Answer | Refusal>;

export interface Registration {
  readonly id: string;
  readonly handler: Handler;
  /** false exempts the handler from the Node floor; only `doctor` uses it. */
  readonly nodeGate?: boolean;
  /**
   * A Change-scoped handler that decides itself whether it needs the Change
   * (`hooks prompt-expansion`): the registry hands it the resolver instead.
   */
  readonly resolvesChange?: "handler";
  /** Guard mode: what a block prints on stdout without `--json` (the host's decision object). */
  readonly blockOutput?: (refusal: Refusal) => string;
}

interface Registry {
  run(invocation: Invocation): Promise<number>;
  implementation(id: string): "handler" | "stub";
}

export function createRegistry(
  index: CommandIndex,
  registrations: readonly Registration[],
  options: RegistryOptions = {},
): Registry {
  const byId = new Map<string, Registration>();
  for (const registration of registrations) {
    if (!index.commands.some((record) => record.id === registration.id)) {
      throw new Error(`registration for ${registration.id}, which the command index does not know`);
    }
    if (byId.has(registration.id)) throw new Error(`${registration.id} is registered twice`);
    byId.set(registration.id, registration);
  }

  return {
    implementation: (id) => (byId.has(id) ? "handler" : "stub"),
    run: (invocation) => run(index, byId, options, invocation),
  };
}

/** `bdk --version` is `bdk version` (`kernel-cli`, Invocation): an implicit spelling of the first argument, like `--help`. */
function withVersionSpelling(argv: readonly string[]): readonly string[] {
  return argv[0] === "--version" ? ["version", ...argv.slice(1)] : argv;
}

async function run(
  index: CommandIndex,
  byId: ReadonlyMap<string, Registration>,
  options: RegistryOptions,
  invocation: Invocation,
): Promise<number> {
  const { streams } = invocation;
  const argv = withVersionSpelling(invocation.argv);
  const asJson = argv.includes("--json");
  const help = argv.includes("--help");
  const resolved = resolve(index, argv);
  const now = options.now ?? Date.now;
  const start = now();

  if (resolved === undefined) {
    const [first] = argv;
    const usage =
      first === undefined || first === "--help"
        ? globalHelp(index)
        : help
          ? groupHelp(index, first)
          : undefined;
    if (help && usage !== undefined) {
      streams.stdout(usage);
      return 0;
    }
    const refusal = unknownCommand(index, argv);
    const exit = writeCommand(streams, refusal, asJson);
    await journal(
      options,
      invocation,
      {},
      {
        kind: "command",
        command: "unknown",
        args: argv,
        exit,
        rule: refusal.rule,
        start,
        ms: now() - start,
      },
    );
    return exit;
  }

  const { record, rest } = resolved;
  if (help) {
    streams.stdout(commandHelp(index, record));
    return 0;
  }

  const facts: Facts = {};
  const finish = async (exit: number, rule: string | null): Promise<number> => {
    // A hook-mode call that neither refuses nor blocks leaves no line: the hooks journal their own events.
    if (record.mode === "command" || rule !== null) {
      await journal(options, invocation, facts, {
        kind: record.mode === "guard" ? "guard" : "command",
        command: record.id,
        args: rest,
        exit,
        rule,
        start,
        ms: now() - start,
      });
    }
    return exit;
  };

  let outcome: Answer | Refusal;
  try {
    outcome = await dispatch(record, byId.get(record.id), options, rest, asJson, invocation, facts);
  } catch (error) {
    if (error instanceof KernelRefusal) outcome = error.refusal;
    else if (record.mode === "command") {
      await finish(1, CRASH);
      throw error;
    } else return finish(writeCrash(streams, record, error), CRASH);
  }

  if (isRefusal(outcome)) {
    if (record.mode === "inject")
      return finish(writeInject(streams, outcome, asJson), outcome.rule);
    if (record.mode === "guard") {
      return finish(
        writeBlock(streams, outcome, asJson, byId.get(record.id)?.blockOutput),
        outcome.rule,
      );
    }
    return finish(writeCommand(streams, outcome, asJson), outcome.rule);
  }
  if (asJson) streams.stdout(json(outcome.data));
  // Only list verbs cap their text at 100 lines, in their handlers, behind their
  // own `--all`; any other text, a `show` body included, is printed whole.
  else if (outcome.text !== "") streams.stdout(ensureNewline(outcome.text));
  return finish(0, null);
}

/** The journal's `rule` of a handler that threw: a kernel bug, not a refusal. */
const CRASH = "kernel/crash";

/** What dispatch learns on the way, for the journal line. */
interface Facts {
  workTree?: string | undefined;
  change?: string;
  ticket?: string;
  agent?: string;
}

async function journal(
  options: RegistryOptions,
  { cwd, runtime }: Invocation,
  facts: Facts,
  line: {
    readonly kind: "command" | "guard";
    readonly command: string;
    readonly args: readonly string[];
    readonly exit: number;
    readonly rule: string | null;
    readonly start: number;
    readonly ms: number;
  },
): Promise<void> {
  if (options.journal === undefined) return;
  try {
    // A standalone record (the hooks, `version`) never looked for its work tree; outside one there is no line.
    const workTree = facts.workTree ?? runtime.workTree(cwd);
    if (workTree === undefined) return;
    await options.journal({
      cwd,
      workTree,
      line: {
        v: 1,
        at: new Date(line.start).toISOString(),
        command: line.command,
        args: line.args,
        exit: line.exit,
        rule: line.rule,
        ticket: facts.ticket ?? null,
        change: facts.change ?? null,
        ms: line.ms,
        ...(line.kind === "guard"
          ? { kind: "guard", agent: facts.agent ?? "main" }
          : { kind: "command" }),
      },
    });
  } catch {
    // The journal is diagnostics: it never changes a command's output or exit code.
  }
}

async function dispatch(
  record: CommandRecord,
  registration: Registration | undefined,
  options: RegistryOptions,
  rest: readonly string[],
  asJson: boolean,
  { cwd, runtime }: Invocation,
  facts: Facts,
): Promise<Answer | Refusal> {
  if (record.standalone !== true) facts.workTree = runtime.workTree(cwd);
  const parsed = parse(record, rest);
  if (isRefusal(parsed)) return parsed;
  const ticket = parsed.flags["--ticket"] ?? parsed.positionals["<ticket>"];
  if (typeof ticket === "string") facts.ticket = ticket;

  let workTree: string | undefined;
  if (record.standalone !== true) {
    if (registration?.nodeGate !== false && !meetsNodeMinimum(runtime.nodeVersion)) {
      return nodeVersionRefusal(runtime.nodeVersion);
    }
    workTree = facts.workTree;
    if (workTree === undefined) {
      return refuse("runtime/not-a-repo", `${cwd} is not inside a git work tree`, [
        "run bdk inside a git repository",
        "git init",
      ]);
    }
  }

  if (registration === undefined) return stub(record);
  let change: ActiveChange | undefined;
  let resolveChange: (() => ActiveChange | Refusal) | undefined;
  if (record.changeScoped) {
    const resolver = options.activeChange;
    if (resolver === undefined || workTree === undefined) {
      throw new Error(
        `${record.id} is Change-scoped but the registry has no active-Change resolver`,
      );
    }
    if (registration.resolvesChange === "handler") {
      resolveChange = () => resolver({ cwd, workTree });
    } else {
      const resolved = resolver({ cwd, workTree });
      if (isRefusal(resolved)) return resolved;
      change = resolved;
      facts.change = resolved.id;
    }
  }
  const context: CommandContext = {
    record,
    positionals: parsed.positionals,
    lists: parsed.lists,
    flags: parsed.flags,
    json: asJson,
    cwd,
    runtime,
    noteAgent: (agent) => {
      facts.agent = agent;
    },
    ...(workTree === undefined ? {} : { workTree }),
    ...(change === undefined ? {} : { change }),
    ...(resolveChange === undefined ? {} : { resolveChange }),
  };
  return registration.handler(context);
}

function stub(record: CommandRecord): Refusal {
  return refuse(
    "kernel/not-implemented",
    `${commandLine(record)} is not implemented yet; it lands with task ${record.owner}`,
    [`use a BDK release that includes task ${record.owner}`, `bdk ${record.argv[0] ?? ""} --help`],
  );
}

function writeCommand(streams: Streams, refusal: Refusal, asJson: boolean): number {
  streams.stdout(asJson ? json(refusal) : refusalText(refusal));
  return exitCodeFor(refusal.rule);
}

function writeInject(streams: Streams, refusal: Refusal, asJson: boolean): number {
  streams.stdout(asJson ? json(refusal) : stopBlock(refusal));
  return 0;
}

function writeBlock(
  streams: Streams,
  refusal: Refusal,
  asJson: boolean,
  blockOutput: ((refusal: Refusal) => string) | undefined,
): number {
  if (asJson) streams.stdout(json(refusal));
  else if (blockOutput !== undefined) streams.stdout(ensureNewline(blockOutput(refusal)));
  streams.stderr(`${blockReason(refusal)}\n`);
  return 2;
}

function writeCrash(streams: Streams, record: CommandRecord, error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const why = `${commandLine(record)} failed: ${message}`;
  if (record.mode === "guard") {
    streams.stderr(`${why}\n`);
    return 2;
  }
  streams.stdout(
    stopBlock({
      why,
      instead: ["bdk doctor", "report the error at https://github.com/broneq/bdk/issues"],
    }),
  );
  return 0;
}

function ensureNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
