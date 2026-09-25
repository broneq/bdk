// The pipeline of design D-5 and the mode wrapper: every call is resolved,
// helped, parsed, checked and dispatched in one order, then turned into the
// contract shape of the record's `mode` (`kernel-cli`, Output modes).
import { capLines, json, refusalText, stopBlock } from "../output/index.ts";
import type { Streams } from "../output/index.ts";
import { exitCodeFor, KernelRefusal, refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import { commandHelp, globalHelp, groupHelp } from "./help.ts";
import { meetsNodeMinimum, nodeVersionRefusal } from "./node-version.ts";
import { parse } from "./parse.ts";
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
  readonly flags: Readonly<Record<string, string | true>>;
  readonly json: boolean;
  readonly cwd: string;
  /** Absent only for the standalone `version`. */
  readonly workTree?: string;
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
}

interface Registry {
  run(invocation: Invocation): Promise<number>;
  implementation(id: string): "handler" | "stub";
}

export function createRegistry(
  index: CommandIndex,
  registrations: readonly Registration[],
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
    run: (invocation) => run(index, byId, invocation),
  };
}

async function run(
  index: CommandIndex,
  byId: ReadonlyMap<string, Registration>,
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
    outcome = await dispatch(record, byId.get(record.id), rest, asJson, invocation);
  } catch (error) {
    if (error instanceof KernelRefusal) outcome = error.refusal;
    else if (record.mode === "command") throw error;
    else return writeCrash(streams, record, error);
  }

  if (isRefusal(outcome)) {
    if (record.mode === "inject") return writeInject(streams, outcome, asJson);
    if (record.mode === "guard") return writeBlock(streams, outcome, asJson);
    return writeCommand(streams, outcome, asJson);
  }
  if (asJson) streams.stdout(json(outcome.data));
  else if (outcome.text !== "") {
    streams.stdout(
      record.mode === "command"
        ? capLines(outcome.text, { all: rest.includes("--all") })
        : ensureNewline(outcome.text),
    );
  }
  return 0;
}

async function dispatch(
  record: CommandRecord,
  registration: Registration | undefined,
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
  const context: CommandContext = {
    record,
    positionals: parsed.positionals,
    flags: parsed.flags,
    json: asJson,
    cwd,
    runtime,
    ...(workTree === undefined ? {} : { workTree }),
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

function writeBlock(streams: Streams, refusal: Refusal, asJson: boolean): number {
  if (asJson) streams.stdout(json(refusal));
  streams.stderr(`${refusal.why}\n`);
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

function isRefusal(value: object): value is Refusal {
  return "refused" in value;
}

function ensureNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
