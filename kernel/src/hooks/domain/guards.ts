// The decisions of `hooks pre-tool` (`kernel-cli/hooks`, Pre-tool guards; T24
// design D-3 to D-9). Pure: the payload and a classifier of kernel verbs in,
// the first matching deny (or none) out. Main-thread git and main-thread
// orchestrator commands are never denied.
import type { PreToolPayload } from "./payload.ts";
import { basename, commandWords, readCommands } from "./shell.ts";
import type { SimpleCommand } from "./shell.ts";

type GuardRule =
  | "guard/spec-dir-write"
  | "guard/hooks-from-bash"
  | "guard/nested-stage-command"
  | "guard/subagent-git"
  | "guard/subagent-kernel-command"
  | "guard/reader-write"
  | "guard/dispatch-prompt";

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
}

export type Classify = (argv: readonly string[]) => KernelVerb | undefined;

const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);

/** The adapters whose Bash is for kernel commands and test runs only (T23-D20). */
const READ_ONLY_ADAPTERS = new Set(["bdk:reader", "bdk:reviewer", "bdk:scout"]);

/** The five adapters a BDK dispatch goes to (T23-D19). */
const ADAPTERS = new Set(["bdk:worker", "bdk:reader", "bdk:reviewer", "bdk:runner", "bdk:scout"]);

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

export function preToolDecision(payload: PreToolPayload, classify: Classify): Deny | undefined {
  const cwd = payload.cwd ?? "/";
  if (EDIT_TOOLS.has(payload.tool)) {
    const path =
      stringField(payload.input, "file_path") ?? stringField(payload.input, "notebook_path");
    return path !== undefined && underSpecs(cwd, path) ? specDeny(path) : undefined;
  }
  if (payload.tool === "Agent") return dispatchDecision(payload.input);
  if (payload.tool !== "Bash") return undefined;
  const text = stringField(payload.input, "command");
  if (text === undefined) return undefined;
  const commands = readCommands(text);
  const subagent = payload.agentId !== undefined;
  const readOnly = subagent && READ_ONLY_ADAPTERS.has(payload.agentType ?? "");

  for (const check of [
    (command: SimpleCommand) => specWrite(command, cwd),
    (command: SimpleCommand) => kernelHook(command, classify),
    nestedStage,
    ...(subagent
      ? [subagentGit, (command: SimpleCommand) => subagentKernel(command, classify)]
      : []),
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

/** The words after `bdk.mjs` when the command runs the kernel, else undefined. */
function kernelArgv(command: SimpleCommand): readonly string[] | undefined {
  const words = commandWords(command);
  const name = basename(words[0] ?? "");
  if (name === "bdk.mjs") return words.slice(1);
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

function subagentKernel(command: SimpleCommand, classify: Classify): Deny | undefined {
  const verb = kernelVerb(command, classify);
  if (verb?.availability !== "orchestrator") return undefined;
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

function dispatchDecision(input: Readonly<Record<string, unknown>>): Deny | undefined {
  const adapter = stringField(input, "subagent_type");
  if (adapter === undefined || !ADAPTERS.has(adapter)) return undefined;
  if (isDispatchPrompt((stringField(input, "prompt") ?? "").trim())) return undefined;
  return {
    rule: "guard/dispatch-prompt",
    verb: adapter,
    reason:
      "a BDK dispatch prompt is the package path plus at most one sentence; put the context into the package (BDK T23-D0)",
  };
}

/** Exactly one package path and, besides it, one short sentence at most. */
function isDispatchPrompt(prompt: string): boolean {
  const paths = [...prompt.matchAll(DISPATCH_PATH)];
  if (paths.length !== 1) return false;
  const rest = prompt.replace(paths[0]?.[1] ?? "", " ").trim();
  const ends = rest.match(/[.!?](?=\s|$)/g) ?? [];
  return !/\n\s*\n/.test(prompt) && rest.length <= 200 && ends.length <= 1;
}
