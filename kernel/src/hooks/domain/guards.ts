// The decisions of `hooks pre-tool` (`kernel-cli/hooks`, Pre-tool guards; T24
// design D-3 to D-9). Pure: the payload and a classifier of kernel verbs in,
// the first matching deny (or none) out. Main-thread git and main-thread
// orchestrator commands are never denied. The agent guards of T41 read the
// registry and the Change through `AgentFacts`, which the use case gathers
// only for the payloads that need them.
import type { PreToolPayload } from "./payload.ts";
import { basename, commandWords, readCommands } from "./shell.ts";
import type { SimpleCommand } from "./shell.ts";

type GuardRule =
  | "guard/spec-dir-write"
  | "guard/hooks-from-bash"
  | "guard/nested-stage-command"
  | "guard/subagent-git"
  | "guard/subagent-kernel-command"
  | "guard/lead-scope"
  | "guard/reader-write"
  | "guard/dispatch-prompt"
  | "guard/agent-spawn"
  | "guard/agent-message";

export interface Deny {
  readonly rule: GuardRule;
  /** What was matched: the git verb, the kernel command, the path or the adapter. */
  readonly verb: string;
  /** The reason after the rule id (`kernel-cli/hooks`, Hook payloads). */
  readonly reason: string;
}

/** A kernel command resolved from its argv against the command index. */
interface KernelVerb {
  /** As the user types it, e.g. `bdk commit`. */
  readonly command: string;
  readonly availability: "orchestrator" | "agent" | "read" | "hook";
  /** The words after the verb that are not flags or flag values. */
  readonly positionals: readonly string[];
}

/** What the agent guards know about the caller, from the registry and the active Change. */
export interface AgentFacts {
  /** The caller's active package: its ticket and target; absent without one. */
  readonly caller?: { readonly ticket: string | null; readonly target: string | null };
  /** The target of a ticket of the active Change. */
  readonly ticketTarget: (ticket: string) => string | undefined;
  /** Scouts started by agents holding the caller's ticket. */
  readonly scouts: number;
  readonly scoutLimit: number;
  readonly messageLimit: number;
  /** The derived state of an agent in the registry; undefined when it holds none. */
  readonly stateOf: (id: string) => string | undefined;
  /** Whether the active Change holds the ledger entry. */
  readonly entryExists: (id: string) => boolean;
}

export type Classify = (argv: readonly string[]) => KernelVerb | undefined;

const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);

/** The adapters whose Bash is for kernel commands and test runs only (T23-D20, T41-D11). */
const READ_ONLY_ADAPTERS = new Set(["bdk:reader", "bdk:reviewer", "bdk:scout", "bdk:lead"]);

/** The adapters a BDK dispatch goes to (T23-D19, T41-D2). */
const ADAPTERS = new Set([
  "bdk:worker",
  "bdk:reader",
  "bdk:reviewer",
  "bdk:runner",
  "bdk:scout",
  "bdk:lead",
]);

/** The orchestrator verbs a lead runs inside its own part (T41-D11). */
const LEAD_VERBS = new Set([
  "bdk attempt open",
  "bdk attempt close",
  "bdk dispatch build",
  "bdk commit",
]);

/** Who starts whom (T41-D4); the `Agent(...)` lists of the lead and worker adapters say the same. */
export const SPAWNS: Readonly<Record<string, ReadonlySet<string>>> = {
  "bdk:lead": new Set(["bdk:worker", "bdk:runner", "bdk:reviewer", "bdk:scout"]),
  "bdk:worker": new Set(["bdk:scout"]),
};

const ENTRY_ID = /\bL-[0-9a-z]{8}\b/g;

const STAGE_COMMAND = /^\/bdk:(plan|execute|close|run)(\s|$)/;

const GIT_ALWAYS = new Set([
  "stash",
  "reset",
  "clean",
  "restore",
  "commit",
  "add",
  "merge",
  "rebase",
  "cherry-pick",
  "push",
]);

/** git's global options that take the next word as their value. */
const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);

const NOT_WRITTEN = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);

const WRITE_REDIRECTS = new Set([">", ">>", ">|", "&>", "&>>", "<>", ">&"]);

const DISPATCH_PATH =
  /(?:^|[\s"'`(/])((?:\/|\.{1,2}\/|[^\s"'`]*\/)?\.bdk\/changes\/[^/\s]+\/dispatch\/[^/\s]+\.md)/g;

/** Whether the decision needs `AgentFacts`: the agent guards of a subagent's payload. */
export function needsAgentFacts(payload: PreToolPayload): boolean {
  if (payload.agentId === undefined) return false;
  if (payload.tool === "Agent" || payload.tool === "SendMessage") return true;
  return payload.tool === "Bash" && payload.agentType === "bdk:lead";
}

export function preToolDecision(
  payload: PreToolPayload,
  classify: Classify,
  facts?: AgentFacts,
): Deny | undefined {
  const cwd = payload.cwd ?? "/";
  if (EDIT_TOOLS.has(payload.tool)) {
    const path =
      stringField(payload.input, "file_path") ?? stringField(payload.input, "notebook_path");
    return path !== undefined && underSpecs(cwd, path) ? specDeny(path) : undefined;
  }
  if (payload.tool === "Agent") {
    return dispatchDecision(payload) ?? spawnDecision(payload, facts);
  }
  if (payload.tool === "SendMessage") return messageDecision(payload, facts);
  if (payload.tool !== "Bash") return undefined;
  const text = stringField(payload.input, "command");
  if (text === undefined) return undefined;
  const commands = readCommands(text);
  const subagent = payload.agentId !== undefined;
  const lead = subagent && payload.agentType === "bdk:lead";
  const readOnly = subagent && READ_ONLY_ADAPTERS.has(payload.agentType ?? "");

  for (const check of [
    (command: SimpleCommand) => specWrite(command, cwd),
    (command: SimpleCommand) => kernelHook(command, classify),
    nestedStage,
    ...(subagent
      ? [subagentGit, (command: SimpleCommand) => subagentKernel(command, classify, lead)]
      : []),
    ...(lead ? [(command: SimpleCommand) => leadScope(command, classify, facts)] : []),
    ...(readOnly
      ? [(command: SimpleCommand) => readerWrite(command, payload.agentType ?? "")]
      : []),
  ]) {
    for (const command of commands) {
      const deny = check(command);
      if (deny !== undefined) return deny;
    }
  }
  return undefined;
}

function stringField(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

function underSpecs(cwd: string, path: string): boolean {
  const absolute = resolvePath(cwd, path.split("\\").join("/"));
  return absolute.endsWith("/.bdk/specs") || absolute.includes("/.bdk/specs/");
}

/** `path` against `cwd`, with `.` and `..` segments folded (POSIX `path.resolve` without node:path). */
function resolvePath(cwd: string, path: string): string {
  const segments: string[] = [];
  for (const segment of (path.startsWith("/") ? path : `${cwd}/${path}`).split("/")) {
    if (segment === "..") segments.pop();
    else if (segment !== "" && segment !== ".") segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

function specDeny(path: string): Deny {
  return {
    rule: "guard/spec-dir-write",
    verb: path,
    reason: `${path} is under .bdk/specs/, which only bdk spec merge writes at close; put the change into the Change's spec-delta/ (BDK V1-7)`,
  };
}

function specWrite(command: SimpleCommand, cwd: string): Deny | undefined {
  const target = writesOf(command).find((path) => underSpecs(cwd, path));
  return target === undefined ? undefined : specDeny(target);
}

/**
 * The words after `bdk.mjs` when the command runs the kernel, else undefined.
 * A command word `bdk` counts too: the role contracts write kernel commands as
 * `bdk <command>`, so a model defines `bdk() { node .../bdk.mjs "$@"; }` and
 * calls `bdk attempt open ...` in the same Bash command.
 */
function kernelArgv(command: SimpleCommand): readonly string[] | undefined {
  const words = commandWords(command);
  const name = basename(words[0] ?? "");
  if (name === "bdk.mjs" || name === "bdk") return words.slice(1);
  if (name !== "node") return undefined;
  let at = 1;
  while ((words[at] ?? "").startsWith("-")) at += 1;
  return basename(words[at] ?? "") === "bdk.mjs" ? words.slice(at + 1) : undefined;
}

function kernelVerb(command: SimpleCommand, classify: Classify): KernelVerb | undefined {
  const argv = kernelArgv(command);
  if (argv === undefined || argv.includes("--help")) return undefined;
  return classify(argv);
}

function kernelHook(command: SimpleCommand, classify: Classify): Deny | undefined {
  const verb = kernelVerb(command, classify);
  if (verb?.availability !== "hook") return undefined;
  return {
    rule: "guard/hooks-from-bash",
    verb: verb.command,
    reason: `${verb.command} runs only from the host's hooks; stop and let the user type the stage command (BDK T1)`,
  };
}

function subagentKernel(
  command: SimpleCommand,
  classify: Classify,
  lead: boolean,
): Deny | undefined {
  const verb = kernelVerb(command, classify);
  if (verb?.availability !== "orchestrator") return undefined;
  if (lead && LEAD_VERBS.has(verb.command)) return undefined;
  return {
    rule: "guard/subagent-kernel-command",
    verb: verb.command,
    reason: `subagents may not run ${verb.command}, an ${verb.availability} command; return blocked with the cause, the orchestrator runs it (BDK T3)`,
  };
}

function nestedStage(command: SimpleCommand): Deny | undefined {
  const words = commandWords(command);
  if (basename(words[0] ?? "") !== "claude") return undefined;
  const stage = words.slice(1).find((word) => STAGE_COMMAND.test(word));
  if (stage === undefined) return undefined;
  const typed = stage.split(/\s/)[0] ?? stage;
  return {
    rule: "guard/nested-stage-command",
    verb: typed,
    reason: `a nested claude session would type ${typed} as the user; stop and ask the user to type it (BDK T1)`,
  };
}

/** The git verb as the deny names it, or undefined when the command is allowed. */
function deniedGitVerb(words: readonly string[]): string | undefined {
  let at = 1;
  while (at < words.length) {
    const word = words[at] ?? "";
    if (GIT_VALUE_OPTIONS.has(word)) at += 2;
    else if (word.startsWith("-")) at += 1;
    else break;
  }
  const verb = words[at];
  if (verb === undefined) return undefined;
  const rest = words.slice(at + 1);
  if (GIT_ALWAYS.has(verb)) return `git ${verb}`;
  const force = rest.some((word) => word === "-f" || word === "--force");
  if (verb === "checkout") {
    if (rest.includes("--")) return "git checkout -- <path>";
    if (rest.includes(".")) return "git checkout .";
    if (force) return "git checkout --force";
  }
  if (verb === "switch") {
    if (rest.includes("--discard-changes")) return "git switch --discard-changes";
    if (force) return "git switch --force";
  }
  return undefined;
}

function subagentGit(command: SimpleCommand): Deny | undefined {
  const words = commandWords(command);
  if (basename(words[0] ?? "") !== "git") return undefined;
  const verb = deniedGitVerb(words);
  if (verb === undefined) return undefined;
  return {
    rule: "guard/subagent-git",
    verb,
    reason: `subagents may not run ${verb}; return blocked with the cause instead of changing the shared working tree or history (BDK T3)`,
  };
}

function readerWrite(command: SimpleCommand, adapter: string): Deny | undefined {
  if (writesOf(command).length === 0) return undefined;
  const shown = commandWords(command).join(" ") || command.words.join(" ");
  const clipped = shown.length > 80 ? `${shown.slice(0, 77)}...` : shown;
  return {
    rule: "guard/reader-write",
    verb: clipped,
    reason: `the ${adapter.replace(/^bdk:/, "")} adapter may not write files (${clipped}); report through bdk log add or bdk log ingest instead (BDK T23-D20)`,
  };
}

/** The paths a simple command writes (`kernel-cli/hooks`, Pre-tool command reading); `?` when unknown. */
function writesOf(command: SimpleCommand): string[] {
  const targets = command.redirects
    .filter((redirect) => WRITE_REDIRECTS.has(redirect.op))
    .map((redirect) => redirect.target)
    .filter((target) => !NOT_WRITTEN.has(target) && !/^(\d+|-)$/.test(target));
  const words = commandWords(command);
  const name = basename(words[0] ?? "");
  const args = words.slice(1);
  const operands = args.filter((word) => !word.startsWith("-"));
  switch (name) {
    case "tee":
      return [...targets, ...operands.filter((word) => !NOT_WRITTEN.has(word))];
    case "sed":
    case "perl":
      return args.some((word) => word === "--in-place" || /^-[a-zA-Z]*i/.test(word))
        ? [...targets, ...operands]
        : targets;
    case "cp":
    case "install":
      return operands.length > 1 ? [...targets, operands.at(-1) ?? "?"] : targets;
    case "mv":
    case "rm":
    case "rmdir":
    case "touch":
    case "mkdir":
    case "ln":
    case "truncate":
    case "chmod":
    case "chown":
      return [...targets, ...(operands.length > 0 ? operands : ["?"])];
    case "dd":
      return [
        ...targets,
        ...args.filter((word) => word.startsWith("of=")).map((word) => word.slice(3)),
      ];
    case "git":
      return args.find((word) => !word.startsWith("-")) === "apply" ? [...targets, "?"] : targets;
    default:
      return targets;
  }
}

/** The target a lead's kernel command acts on; undefined when it names none. */
function leadTarget(verb: KernelVerb, facts: AgentFacts | undefined): string | undefined {
  const [first, second] = verb.positionals;
  switch (verb.command) {
    case "bdk attempt open":
      return second;
    case "bdk attempt close":
      return first === undefined ? undefined : facts?.ticketTarget(first);
    default:
      return first;
  }
}

function leadScope(
  command: SimpleCommand,
  classify: Classify,
  facts: AgentFacts | undefined,
): Deny | undefined {
  const verb = kernelVerb(command, classify);
  if (verb === undefined || !LEAD_VERBS.has(verb.command)) return undefined;
  const part = facts?.caller?.target ?? null;
  if (part === null) {
    return {
      rule: "guard/lead-scope",
      verb: verb.command,
      reason: `this lead has no package in the agent registry, so it may not run ${verb.command}: a lead started in the foreground is linked to its package only when it ends; return blocked with the cause, and the orchestrator starts the lead again with run_in_background: true (BDK T41-D11)`,
    };
  }
  const target = leadTarget(verb, facts);
  if (target !== undefined && (target === part || target.startsWith(`${part}-`))) return undefined;
  return {
    rule: "guard/lead-scope",
    verb: verb.command,
    reason: `a lead runs ${verb.command} only on targets of its own part ${part}, not ${target ?? "an unknown target"}; return blocked with the cause (BDK T41-D11)`,
  };
}

/** A scout a worker starts carries its question, not a package (`role-contracts`). */
function workerScout(payload: PreToolPayload): boolean {
  return (
    payload.agentType === "bdk:worker" &&
    stringField(payload.input, "subagent_type") === "bdk:scout"
  );
}

function spawnDecision(payload: PreToolPayload, facts: AgentFacts | undefined): Deny | undefined {
  const caller = payload.agentType ?? "";
  if (payload.agentId === undefined || !caller.startsWith("bdk:")) return undefined;
  const type = stringField(payload.input, "subagent_type") ?? "general-purpose";
  const allowed = SPAWNS[caller];
  if (allowed?.has(type) !== true) {
    return {
      rule: "guard/agent-spawn",
      verb: type,
      reason: `a ${caller} may not start ${type}; ${allowed === undefined ? "it starts no agents" : `it starts only ${[...allowed].join(", ")}`} (BDK T41-D4)`,
    };
  }
  if (caller === "bdk:worker") {
    const limit = facts?.scoutLimit ?? 0;
    const used = facts?.scouts ?? 0;
    if (used >= limit) {
      return {
        rule: "guard/agent-spawn",
        verb: type,
        reason: `this ticket already started ${String(used)} scouts, the limit agents.scout.max-per-ticket is ${String(limit)}; search yourself or return blocked (BDK T41-D4)`,
      };
    }
  }
  return undefined;
}

/** The ledger ids a message names, in order. */
export function messageEntries(message: string): string[] {
  return [...message.matchAll(ENTRY_ID)].map((match) => match[0]);
}

function messageDecision(payload: PreToolPayload, facts: AgentFacts | undefined): Deny | undefined {
  if (payload.agentId === undefined) return undefined;
  const message = stringField(payload.input, "message") ?? "";
  const to = stringField(payload.input, "to") ?? "";
  const deny = (reason: string): Deny => ({ rule: "guard/agent-message", verb: to, reason });
  const entries = messageEntries(message).filter((id) => facts?.entryExists(id) === true);
  if (entries.length === 0) {
    return deny(
      "a message between agents names a ledger entry of the active Change (L-xxxxxxxx); write the substance with bdk log add first, then send its id (BDK T41-D5)",
    );
  }
  const limit = facts?.messageLimit ?? 0;
  if (message.length > limit) {
    return deny(
      `the message has ${String(message.length)} characters, more than agents.message.max-chars (${String(limit)}); keep the substance in the ledger entry and send its id (BDK T41-D5)`,
    );
  }
  if (to === "main") return undefined;
  const state = facts?.stateOf(to);
  if (state === "running" || state === "starting") return undefined;
  return deny(
    `${to} is ${state ?? "not in the agent registry"}, so it cannot read the message; find the agents the entry affects with bdk agents list --affected-by ${entries[0] ?? ""} (BDK T41-D5)`,
  );
}

function dispatchDecision(payload: PreToolPayload): Deny | undefined {
  const input = payload.input;
  const adapter = stringField(input, "subagent_type");
  if (adapter === undefined || !ADAPTERS.has(adapter)) return undefined;
  if (workerScout(payload)) return undefined;
  if (isDispatchPrompt((stringField(input, "prompt") ?? "").trim())) return undefined;
  return {
    rule: "guard/dispatch-prompt",
    verb: adapter,
    reason:
      "a BDK dispatch prompt is the package path plus at most one sentence; put the context into the package (BDK T23-D0)",
  };
}

/** The dispatch package paths a prompt names, as written. */
export function dispatchPaths(prompt: string): string[] {
  return [...prompt.matchAll(DISPATCH_PATH)].map((match) => match[1] ?? "");
}

/** Exactly one package path and, besides it, one short sentence at most. */
function isDispatchPrompt(prompt: string): boolean {
  const paths = [...prompt.matchAll(DISPATCH_PATH)];
  if (paths.length !== 1) return false;
  const rest = prompt.replace(paths[0]?.[1] ?? "", " ").trim();
  const ends = rest.match(/[.!?](?=\s|$)/g) ?? [];
  return !/\n\s*\n/.test(prompt) && rest.length <= 200 && ends.length <= 1;
}
