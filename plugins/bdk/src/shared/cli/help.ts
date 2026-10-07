// Help rendered from the declarations (spec `bdk-cli`, "Help").

import type { Command, Group } from "./types.ts";

const GLOBAL_FLAGS: readonly (readonly [string, string])[] = [
  ["--help, -h", "Show help"],
  ["--version", "Print the bdk version"],
  ["--json", "Print the result as one JSON document"],
];

function table(title: string, rows: readonly (readonly [string, string])[]): string {
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map(([name]) => name.length));
  return `\n${title}:\n${rows.map(([name, text]) => `  ${name.padEnd(width)}  ${text}\n`).join("")}`;
}

export function globalHelp(groups: readonly Group[]): string {
  return (
    "Usage: bdk <group> [<verb>] [arguments] [flags]\n" +
    table(
      "Command groups",
      groups.map((group) => [group.name, group.summary]),
    ) +
    table("Flags", GLOBAL_FLAGS) +
    "\nRun bdk <group> --help for the commands of a group.\n"
  );
}

export function groupHelp(group: Group): string {
  return (
    `Usage: bdk ${group.name} <verb> [arguments] [flags]\n\n${group.summary}\n` +
    table(
      "Commands",
      group.commands.map((command) => [command.verb ?? "", command.summary]),
    ) +
    table("Flags", GLOBAL_FLAGS) +
    `\nRun bdk ${group.name} <verb> --help for the arguments and flags of a command.\n`
  );
}

export function commandHelp(path: string, command: Command): string {
  const args = command.arguments ?? [];
  const usage = args.map((arg) => (arg.required === true ? `<${arg.name}>` : `[<${arg.name}>]`));
  const flags = Object.entries(command.flags ?? {}).map(
    ([name, flag]) =>
      [
        flag.type === "string" ? `--${name} <value>` : `--${name}`,
        flag.multiple === true ? `${flag.description} (repeatable)` : flag.description,
      ] as const,
  );
  const exits = [
    ["0", "success"],
    ...(command.exits ?? []).map((exit) => [String(exit.code), exit.when] as const),
    ["2", "usage error"],
    ["3", "environment error"],
    ["4", "internal error"],
  ] as const;
  return (
    `Usage: bdk ${[path, ...usage].join(" ")} [flags]\n\n${command.summary}\n` +
    table(
      "Arguments",
      args.map((arg) => [`<${arg.name}>`, arg.description]),
    ) +
    table("Flags", [...flags, ...GLOBAL_FLAGS]) +
    table("Exit codes", exits)
  );
}
