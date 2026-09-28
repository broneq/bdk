// The pipeline of design D-5 and the mode wrapper: every call is resolved,
// helped, parsed, checked and dispatched in one order, then turned into the
// contract shape of the record's `mode` (`kernel-cli`, Output modes).
import { json, refusalText, stopBlock } from "../output/index.ts";
import type { Streams } from "../output/index.ts";
import { exitCodeFor, isRefusal, KernelRefusal, refuse } from "../refusal/index.ts";
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
  /** All of stdin; only a handler that reads a body calls it, so no other command blocks. */
  readStdin(): string;
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

export interface RegistryOptions {
  readonly activeChange?: ActiveChangeResolver;
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

async function run(
  index: CommandIndex,
  byId: ReadonlyMap<string, Registration>,
  options: RegistryOptions,
  invocation: Invocation,
): Promise<number> {
  const { argv, streams } = invocation;
  const asJson = argv.includes("--json");
  const help = argv.includes("--help");
  const resolved = resolve(index, argv);

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
    return writeCommand(streams, unknownCommand(index, argv), asJson);
  }

  const { record, rest } = resolved;
  if (help) {
    streams.stdout(commandHelp(index, record));
    return 0;
  }

  let outcome: Answer | Refusal;
  try {
    outcome = await dispatch(record, byId.get(record.id), options, rest, asJson, invocation);
  } catch (error) {
    if (error instanceof KernelRefusal) outcome = error.refusal;
    else if (record.mode === "command") throw error;
    else return writeCrash(streams, record, error);
  }

  if (isRefusal(outcome)) {
    if (record.mode === "inject") return writeInject(streams, outcome, asJson);
    if (record.mode === "guard") {
      return writeBlock(streams, outcome, asJson, byId.get(record.id)?.blockOutput);
    }
    return writeCommand(streams, outcome, asJson);
  }
  if (asJson) streams.stdout(json(outcome.data));
  // Only list verbs cap their text at 100 lines, in their handlers, behind their
  // own `--all`; any other text, a `show` body included, is printed whole.
  else if (outcome.text !== "") streams.stdout(ensureNewline(outcome.text));
  return 0;
}

async function dispatch(
  record: CommandRecord,
  registration: Registration | undefined,
  options: RegistryOptions,
  rest: readonly string[],
  asJson: boolean,
  { cwd, runtime }: Invocation,
): Promise<Answer | Refusal> {
  const parsed = parse(record, rest);
  if (isRefusal(parsed)) return parsed;

  let workTree: string | undefined;
  if (record.standalone !== true) {
    if (registration?.nodeGate !== false && !meetsNodeMinimum(runtime.nodeVersion)) {
      return nodeVersionRefusal(runtime.nodeVersion);
    }
    workTree = runtime.workTree(cwd);
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
  streams.stderr(`${refusal.rule}: ${refusal.why}\n`);
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
