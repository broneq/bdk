// Step 3 of the pipeline: positionals and flags against the record. `--json`
// and `--help` are implicit on every command and never reach a handler.
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import type { CommandRecord, FlagSpec } from "./record.ts";
import { commandLine } from "./record.ts";

const IMPLICIT_FLAGS = ["--json", "--help"] as const;

/** Kernel-stamped fields (P1): as a flag they are `input/forbidden-field` where declared. */
const STAMPED = ["--id", "--at", "--author", "--source", "--fingerprint"] as const;

/** A switch is `true`, a valued flag its string, a repeatable flag its values in order. */
export type FlagValue = string | true | readonly string[];

export interface Parsed {
  /** Each argument's value; a repeatable argument's first value. */
  readonly positionals: Readonly<Record<string, string>>;
  /** Every value of a repeatable argument, in order. */
  readonly lists: Readonly<Record<string, readonly string[]>>;
  readonly flags: Readonly<Record<string, FlagValue>>;
}

export function parse(record: CommandRecord, tokens: readonly string[]): Parsed | Refusal {
  const help = [`${commandLine(record)} --help`];
  const positionals: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  const flags: Record<string, FlagValue> = {};
  let position = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (!token.startsWith("--")) {
      const arg = record.args[position];
      if (arg?.repeatable !== true) position++;
      if (arg === undefined) {
        return refuse(
          "input/invalid-argument",
          `${commandLine(record)} takes ${record.args.length} arguments; ${token} is one too many`,
          help,
        );
      }
      if (arg.values !== undefined && !arg.values.includes(token)) {
        return refuse(
          "input/invalid-argument",
          `${arg.name} is ${token}; allowed: ${arg.values.join(", ")}`,
          help,
        );
      }
      positionals[arg.name] ??= token;
      if (arg.repeatable === true) (lists[arg.name] ??= []).push(token);
      continue;
    }

    const equals = token.indexOf("=");
    const name = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);
    if ((IMPLICIT_FLAGS as readonly string[]).includes(name) && inline === undefined) continue;
    const spec = record.flags.find((candidate) => candidate.name === name);
    if (spec === undefined) {
      if (
        (STAMPED as readonly string[]).includes(name) &&
        record.refusals.includes("input/forbidden-field")
      ) {
        return refuse(
          "input/forbidden-field",
          `${name.slice(2)} is stamped by the kernel and is never input (P1)`,
          [`${commandLine(record)} without ${name}`, ...help],
        );
      }
      return refuse("input/unknown-flag", `${commandLine(record)} has no flag ${name}`, help);
    }
    if (name in flags && spec.repeatable !== true) {
      return refuse("input/invalid-argument", `${name} is given twice`, help);
    }

    if (!takesValue(spec)) {
      if (inline !== undefined) {
        return refuse(
          "input/invalid-argument",
          `${name} is a switch and takes no value (got ${inline})`,
          help,
        );
      }
      flags[name] = true;
      continue;
    }
    let value = inline;
    if (value === undefined) {
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i++;
      }
    }
    if (value === undefined) {
      return refuse(
        "input/missing-argument",
        `${name} needs a value ${spec.value ?? (spec.values ?? []).join("|")}`,
        help,
      );
    }
    if (spec.values !== undefined && !spec.values.includes(value)) {
      return refuse(
        "input/invalid-argument",
        `${name} is ${value}; allowed: ${spec.values.join(", ")}`,
        help,
      );
    }
    if (spec.repeatable === true) {
      const previous = flags[name];
      flags[name] = [...(Array.isArray(previous) ? (previous as readonly string[]) : []), value];
    } else flags[name] = value;
  }

  const missing = record.args.find((arg) => arg.required && !(arg.name in positionals));
  if (missing !== undefined) {
    return refuse(
      "input/missing-argument",
      `${commandLine(record)} needs the argument ${missing.name}`,
      help,
    );
  }
  return { positionals, lists, flags };
}

export function takesValue(flag: FlagSpec): boolean {
  return flag.value !== undefined || flag.values !== undefined;
}
