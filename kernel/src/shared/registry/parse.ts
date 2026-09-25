// Step 3 of the pipeline: positionals and flags against the record. `--json`
// and `--help` are implicit on every command and never reach a handler.
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import type { CommandRecord, FlagSpec } from "./record.ts";
import { commandLine } from "./record.ts";

const IMPLICIT_FLAGS = ["--json", "--help"] as const;

export interface Parsed {
  readonly positionals: Readonly<Record<string, string>>;
  readonly flags: Readonly<Record<string, string | true>>;
}

export function parse(record: CommandRecord, tokens: readonly string[]): Parsed | Refusal {
  const help = [`${commandLine(record)} --help`];
  const positionals: Record<string, string> = {};
  const flags: Record<string, string | true> = {};
  let position = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (!token.startsWith("--")) {
      const arg = record.args[position++];
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
      positionals[arg.name] = token;
      continue;
    }

    const equals = token.indexOf("=");
    const name = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);
    if ((IMPLICIT_FLAGS as readonly string[]).includes(name) && inline === undefined) continue;
    const spec = record.flags.find((candidate) => candidate.name === name);
    if (spec === undefined) {
      return refuse("input/unknown-flag", `${commandLine(record)} has no flag ${name}`, help);
    }
    if (name in flags) return refuse("input/invalid-argument", `${name} is given twice`, help);

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
    flags[name] = value;
  }

  const missing = record.args.find((arg) => arg.required && !(arg.name in positionals));
  if (missing !== undefined) {
    return refuse(
      "input/missing-argument",
      `${commandLine(record)} needs the argument ${missing.name}`,
      help,
    );
  }
  return { positionals, flags };
}

export function takesValue(flag: FlagSpec): boolean {
  return flag.value !== undefined || flag.values !== undefined;
}
