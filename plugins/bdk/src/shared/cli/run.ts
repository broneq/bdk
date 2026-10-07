// The router of the bdk CLI (spec `bdk-cli`; design D8): argv in, stdout, stderr and the exit
// code out. Every OS value comes in as a parameter, so tests drive it with strings.

import { parseArgs } from "node:util";

import { CliError, EXIT } from "./errors.ts";
import { commandHelp, globalHelp, groupHelp } from "./help.ts";
import { closest } from "./suggest.ts";
import type { Command, Group, Input, Result } from "./types.ts";

export const MIN_NODE = "22.18.0";

export interface RunOptions {
  readonly argv: readonly string[];
  readonly version: string;
  readonly nodeVersion: string;
  readonly groups: readonly Group[];
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

type Outcome =
  | { readonly kind: "print"; readonly text: string }
  | { readonly kind: "result"; readonly result: Result };

const GLOBAL = new Set(["--help", "-h", "--version", "--json"]);

function line(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function older(version: string, minimum: string): boolean {
  const parts = (value: string): number[] =>
    value.split(".").map((part) => Number.parseInt(part, 10));
  const [a, b] = [parts(version), parts(minimum)];
  for (let i = 0; i < b.length; i++) {
    const [x = 0, y = 0] = [a[i], b[i]];
    if (x !== y) return x < y;
  }
  return false;
}

function checkDeclarations(groups: readonly Group[]): void {
  const names = new Set<string>();
  for (const group of groups) {
    if (names.has(group.name)) throw new Error(`two command groups are named ${group.name}`);
    names.add(group.name);
    const verbs = group.commands.map((command) => command.verb);
    if (group.commands.length === 0) throw new Error(`group ${group.name} has no command`);
    if (verbs.includes(undefined) && verbs.length > 1) {
      throw new Error(`group ${group.name} mixes a command without a verb with other commands`);
    }
    if (new Set(verbs).size !== verbs.length)
      throw new Error(`group ${group.name} declares a verb twice`);
  }
}

function parse(path: string, command: Command, argv: readonly string[]): Input {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: Object.fromEntries(
        Object.entries(command.flags ?? {}).map(([name, flag]) => [name, { type: flag.type }]),
      ),
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if ((error as { code?: unknown }).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const flag = /'([^']+)'/.exec(message)?.[1] ?? message;
      throw new CliError(
        "usage/unknown-flag",
        `unknown flag ${flag} for bdk ${path}`,
        `Run bdk ${path} --help for its flags.`,
      );
    }
    throw new CliError("usage/invalid-argument", message, `Run bdk ${path} --help for its flags.`);
  }
  const declared = command.arguments ?? [];
  const extra = parsed.positionals[declared.length];
  if (extra !== undefined)
    throw new CliError(
      "usage/invalid-argument",
      `unexpected argument ${extra}`,
      `Run bdk ${path} --help for its arguments.`,
    );
  const args: Record<string, string | undefined> = {};
  declared.forEach((arg, i) => {
    const value = parsed.positionals[i];
    if (value === undefined && arg.required === true) {
      throw new CliError(
        "usage/missing-argument",
        `missing argument <${arg.name}>`,
        `Run bdk ${path} --help for its arguments.`,
      );
    }
    args[arg.name] = value;
  });
  // No flag is declared `multiple`, so parseArgs gives no arrays.
  const flags: Record<string, string | boolean | undefined> = {};
  for (const [name, value] of Object.entries(parsed.values)) {
    if (!Array.isArray(value)) flags[name] = value;
  }
  return { args, flags };
}

async function route(
  rest: readonly string[],
  help: boolean,
  groups: readonly Group[],
): Promise<Outcome> {
  const [name, ...afterGroup] = rest;
  if (name === undefined) return { kind: "print", text: globalHelp(groups) };
  const group = groups.find((candidate) => candidate.name === name);
  if (group === undefined) {
    const near = closest(
      name,
      groups.map((candidate) => candidate.name),
    );
    const hint = `Run bdk --help for the command groups.`;
    throw new CliError(
      "usage/unknown-command",
      `unknown command group ${name}`,
      near === undefined ? hint : `did you mean ${near}? ${hint}`,
    );
  }
  const [only] = group.commands;
  let command: Command;
  let argv: readonly string[];
  if (only !== undefined && only.verb === undefined) {
    [command, argv] = [only, afterGroup];
  } else {
    const [verb, ...afterVerb] = afterGroup;
    if (verb === undefined) return { kind: "print", text: groupHelp(group) };
    const found = group.commands.find((candidate) => candidate.verb === verb);
    if (found === undefined) {
      if (help) return { kind: "print", text: groupHelp(group) };
      const near = closest(
        verb,
        group.commands.flatMap((candidate) => candidate.verb ?? []),
      );
      const hint = `Run bdk ${group.name} --help for its commands.`;
      throw new CliError(
        "usage/unknown-command",
        `unknown command ${group.name} ${verb}`,
        near === undefined ? hint : `did you mean ${near}? ${hint}`,
      );
    }
    [command, argv] = [found, afterVerb];
  }
  const path = command.verb === undefined ? group.name : `${group.name} ${command.verb}`;
  if (help) return { kind: "print", text: commandHelp(path, command) };
  return { kind: "result", result: await command.run(parse(path, command, argv)) };
}

/** Runs one invocation and returns its exit code. It never reads stdin and never throws. */
export async function run(options: RunOptions): Promise<number> {
  const { argv, version, nodeVersion, groups, stdout, stderr } = options;
  const json = argv.includes("--json");
  const fail = (error: CliError): number => {
    if (json) {
      const body = {
        code: error.code,
        message: error.message,
        ...(error.hint === undefined ? {} : { hint: error.hint }),
      };
      stdout(`${JSON.stringify({ error: body })}\n`);
    } else {
      stderr(`bdk: ${error.message}\n${error.hint === undefined ? "" : `hint: ${error.hint}\n`}`);
    }
    return error.exit;
  };
  try {
    if (older(nodeVersion, MIN_NODE)) {
      return fail(
        new CliError(
          "env/node-version",
          `Node ${nodeVersion} is too old; bdk needs Node ${MIN_NODE} or later`,
          `install Node ${MIN_NODE} or later`,
        ),
      );
    }
    checkDeclarations(groups);
    if (argv.includes("--version")) {
      stdout(`${version}\n`);
      return EXIT.ok;
    }
    const help = argv.includes("--help") || argv.includes("-h");
    const outcome = await route(
      argv.filter((arg) => !GLOBAL.has(arg)),
      help,
      [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    );
    if (outcome.kind === "print") {
      stdout(outcome.text);
      return EXIT.ok;
    }
    stdout(json ? `${JSON.stringify(outcome.result.data)}\n` : line(outcome.result.text));
    return outcome.result.exit ?? EXIT.ok;
  } catch (error) {
    if (error instanceof CliError) return fail(error);
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      stdout(`${JSON.stringify({ error: { code: "internal/unexpected", message } })}\n`);
    } else {
      const stack = error instanceof Error && error.stack !== undefined ? line(error.stack) : "";
      stderr(`bdk: internal error: ${message}\n${stack}`);
    }
    return EXIT.internal;
  }
}
