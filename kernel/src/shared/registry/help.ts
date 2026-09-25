// Step 2 of the pipeline: usage generated at run time from the bundled index,
// so `--help` and `schema/cli/commands.json` cannot drift (`kernel-cli`,
// Invocation, `--help`).
import type { CommandIndex, CommandRecord } from "./record.ts";
import { commandLine } from "./record.ts";
import { takesValue } from "./parse.ts";

export function synopsis(record: CommandRecord): string {
  const args = record.args.map((arg) => {
    const name = arg.name.startsWith("<") ? arg.name : `<${arg.name}>`;
    return arg.required ? name : `[${name}]`;
  });
  const flags = record.flags.map(
    (flag) => `[${flag.name}${takesValue(flag) ? ` ${flagValue(flag)}` : ""}]`,
  );
  return [commandLine(record), ...args, ...flags, "[--json]"].join(" ");
}

export function commandHelp(index: CommandIndex, record: CommandRecord): string {
  const lines = [
    `usage: ${synopsis(record)}`,
    "",
    record.summary,
    "",
    `availability: ${record.availability}`,
    `mode: ${record.mode}`,
    `owner: ${record.owner}`,
  ];
  if (record.args.length > 0) {
    lines.push("", "arguments:");
    for (const arg of record.args) {
      const values = arg.values === undefined ? "" : ` (${arg.values.join("|")})`;
      const detail = [arg.required ? "required" : "optional", arg.description]
        .filter(Boolean)
        .join("; ");
      lines.push(`  ${arg.name}${values}  ${detail}`);
    }
  }
  if (record.flags.length > 0) {
    lines.push("", "flags:");
    for (const flag of record.flags) {
      const value = takesValue(flag) ? ` ${flagValue(flag)}` : "";
      lines.push(
        `  ${flag.name}${value}${flag.description === undefined ? "" : `  ${flag.description}`}`,
      );
    }
  }
  if (record.stdin !== undefined) lines.push("", `stdin: ${record.stdin}`);
  const rules = [
    ...index.base.all,
    ...(record.changeScoped ? index.base.changeScoped : []),
    ...record.refusals,
  ];
  lines.push(
    "",
    `exit codes: ${record.exits.join(", ")}`,
    `rules: ${[...new Set(rules)].join(", ")}`,
  );
  return `${lines.join("\n")}\n`;
}

export function groupHelp(index: CommandIndex, group: string): string | undefined {
  const records = index.commands.filter((record) => record.argv[0] === group);
  if (records.length === 0) return undefined;
  return overview(
    records,
    `usage: bdk ${group} <verb> ... (bdk ${group} <verb> --help for details)`,
  );
}

export function globalHelp(index: CommandIndex): string {
  return overview(
    index.commands,
    "usage: bdk <group> [<verb>] <positional...> [--flag [value]] [--json] (bdk <command> --help for details)",
  );
}

function overview(records: readonly CommandRecord[], header: string): string {
  const width = Math.max(...records.map((record) => record.argv.join(" ").length));
  const lines = records.map(
    (record) => `  ${record.argv.join(" ").padEnd(width)}  ${record.summary}`,
  );
  return `${[header, "", ...lines].join("\n")}\n`;
}

function flagValue(flag: CommandRecord["flags"][number]): string {
  return flag.value ?? (flag.values ?? []).join("|");
}
