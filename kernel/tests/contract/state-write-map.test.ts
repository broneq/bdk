// `kernel-state`, Write map and Write map enforcement (design D-10 of
// v3-t14-state-schema): the file and entry-type tables of the spec against
// `schema/cli/commands.json` and the `**Writes:**` lines of `kernel-cli`.
// Each rule has a negative control seeded into a copy of its input.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ENTRY_TYPES } from "../../src/shared/store/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { backticked, column, requirement, tableRows } from "../support/specs.ts";

const CHANGE_DIR = join(REPO_ROOT, "openspec/changes/v3-t14-state-schema");
const STATE_MAIN = join(REPO_ROOT, "openspec/specs/kernel-state/spec.md");
const CLI_DIR = join(REPO_ROOT, "openspec/specs/kernel-cli");

interface Command {
  readonly argv: readonly string[];
  readonly availability: string;
  readonly writes: readonly string[];
}

/** The spec text in force: the Change's delta until the archive, then the main spec. */
const stateSpec = readFileSync(
  existsSync(STATE_MAIN) ? STATE_MAIN : join(CHANGE_DIR, "specs/kernel-state/spec.md"),
  "utf8",
);

const commands = (
  JSON.parse(readFileSync(join(REPO_ROOT, "schema/cli/commands.json"), "utf8")) as {
    commands: Command[];
  }
).commands;

/** The items of a `**Writes:**` line; a line starting with "nothing" declares none. */
function writesItems(line: string): string[] {
  if (line.startsWith("nothing")) return [];
  return line.split(", ").map((item) => item.trim().replace(/^`(.*)`$/, "$1"));
}

/** `**Writes:**` items per command, a Change delta's requirement replacing the main one. */
function writesLines(): Map<string, string[]> {
  const lines = new Map<string, string[]>();
  const read = (text: string): void => {
    for (const part of text.split(/^### Requirement: /m).slice(1)) {
      if (!part.startsWith("bdk ")) continue;
      const name = (part.split("\n")[0] ?? "").slice(4).trim();
      const line = /^- \*\*Writes:\*\* (.*)$/m.exec(part)?.[1];
      if (line !== undefined) lines.set(name, writesItems(line));
    }
  };
  const groups = readdirSync(CLI_DIR, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  for (const group of groups) read(readFileSync(join(CLI_DIR, group.name, "spec.md"), "utf8"));
  const deltas = join(CHANGE_DIR, "specs/kernel-cli");
  if (existsSync(deltas)) {
    for (const group of readdirSync(deltas, { withFileTypes: true })) {
      const path = join(deltas, group.name, "spec.md");
      if (group.isDirectory() && existsSync(path)) read(readFileSync(path, "utf8"));
    }
  }
  return lines;
}

/**
 * A path in one namespace: `change:<path in the Change>` (`change:` alone is
 * the whole Change), `archive:` or `rules:`; undefined outside the state.
 */
function statePath(path: string): string | undefined {
  if (path === ".bdk/changes/" || path === ".bdk/changes/<id>/") return "change:";
  if (path.startsWith(".bdk/changes/archive/")) return "archive:";
  if (path.startsWith(".bdk/changes/<id>/"))
    return `change:${path.slice(".bdk/changes/<id>/".length)}`;
  if (path.startsWith(".bdk/rules/")) return "rules:";
  return undefined;
}

/** The file-table rows named in prose: a migration may rewrite any document, rules included. */
const ROW_PATHS: Readonly<Record<string, readonly string[]>> = {
  "any file (migration)": ["change:", "rules:"],
  "the Change directory (archive)": ["archive:"],
};

function rowPaths(cell: string): string[] {
  const fixed = ROW_PATHS[cell];
  if (fixed !== undefined) return [...fixed];
  return backticked(cell).map((path) => statePath(path) ?? `change:${path}`);
}

/** The command names in a writers cell: code spans that are commands, flags dropped. */
function commandsIn(cell: string, known: ReadonlySet<string>): string[] {
  return backticked(cell)
    .map((span) =>
      span
        .split(" ")
        .filter((word) => !word.startsWith("--"))
        .join(" "),
    )
    .filter((name) => known.has(name));
}

/** Every write-map problem; [] when the spec, `commands.json` and `kernel-cli` agree. */
function problems(
  spec: string,
  index: readonly Command[],
  writes: Map<string, string[]>,
): string[] {
  const found: string[] = [];
  const byName = new Map(index.map((command) => [command.argv.join(" "), command]));
  const known = new Set(byName.keys());
  const map = requirement(spec, "Write map");

  // The file table: path -> the commands that write it.
  const files = tableRows(map, "Path").map((row) => ({
    paths: rowPaths(column(row, "Path")),
    writers: commandsIn(column(row, "Writers"), known),
    anyWriter: column(row, "Writers") !== "",
  }));
  const types = tableRows(map, "Type").map((row) => ({
    type: backticked(column(row, "Type"))[0] ?? "",
    cell: column(row, "Writers and `source`"),
  }));
  const mutations =
    /In-place mutations[^\n]*/.exec(requirement(spec, "Derived state and mutation"))?.[0] ?? "";
  const logWriters = new Set([
    ...types.flatMap((row) => commandsIn(row.cell, known)),
    ...commandsIn(mutations, known),
  ]);

  // Every layout row and every entry type has a writer.
  for (const row of tableRows(requirement(spec, "Change directory layout"), "Path")) {
    const path = `change:${backticked(column(row, "Path"))[0] ?? ""}`;
    const covered = files.some(
      (file) =>
        file.anyWriter &&
        file.paths.some((p) => p !== "change:" && (path === p || path.startsWith(p))),
    );
    if (!covered) found.push(`layout row ${path} has no writer`);
  }
  for (const type of ENTRY_TYPES) {
    const row = types.find((entry) => entry.type === type);
    if (row === undefined || commandsIn(row.cell, known).length === 0) {
      found.push(`entry type ${type} has no command writer`);
    }
  }

  // Each command writer can write: not `read`, and its writes[] covers the path.
  const claims = [
    ...files.flatMap((file) => file.writers.map((writer) => ({ writer, paths: file.paths }))),
    ...[...logWriters].map((writer) => ({ writer, paths: ["change:log/"] })),
  ];
  for (const { writer, paths } of claims) {
    const command = byName.get(writer);
    if (command === undefined) continue;
    if (command.availability === "read") found.push(`${writer} is a read command`);
    const declared = command.writes.map(statePath).filter((path) => path !== undefined);
    for (const path of paths) {
      if (!declared.some((write) => path.startsWith(write))) {
        found.push(`${writer} writes ${path} without declaring it in writes[]`);
      }
    }
  }

  // Every state path in writes[] is named for that command in the tables.
  for (const [name, command] of byName) {
    for (const write of command.writes) {
      const path = statePath(write);
      if (path === undefined) continue;
      const named =
        (path === "change:log/" && logWriters.has(name)) ||
        files.some(
          (file) =>
            file.writers.includes(name) &&
            file.paths.some((row) => row === path || row.startsWith(path) || path.startsWith(row)),
        );
      if (!named)
        found.push(`${name} declares ${write}, which the file table does not name it for`);
    }
  }

  // The `**Writes:**` line of each command requirement equals its writes[].
  for (const [name, command] of byName) {
    const line = writes.get(name);
    if (line === undefined) found.push(`${name} has no **Writes:** line`);
    else if (line.join("\n") !== command.writes.join("\n")) {
      found.push(
        `${name}: **Writes:** ${line.join(", ")} differs from writes[] ${command.writes.join(", ")}`,
      );
    }
  }

  // `source: user` is stamped only by `hooks prompt-expansion`.
  for (const row of types) {
    for (const segment of row.cell.split(";")) {
      if (!backticked(segment).includes("user")) continue;
      const writers = commandsIn(segment, known);
      if (writers.join() !== "hooks prompt-expansion") {
        found.push(`entry type ${row.type}: source user stamped by ${writers.join(", ")}`);
      }
    }
  }
  return found;
}

const writes = writesLines();

describe("state write map", () => {
  it("names a writer for every file and entry type and agrees with the CLI contract", () => {
    expect(problems(stateSpec, commands, writes)).toStrictEqual([]);
  });

  it("fails on a read command as a writer", () => {
    const seeded = stateSpec.replace("| `evidence record` ", "| `evidence check` ");
    expect(problems(seeded, commands, writes)).toContain("evidence check is a read command");
  });

  it("fails on an undeclared write", () => {
    const seeded = commands.map((command) =>
      command.argv.join(" ") === "attempt open"
        ? { ...command, writes: [...command.writes, ".bdk/changes/<id>/dispatch/"] }
        : command,
    );
    expect(problems(stateSpec, seeded, writes)).toStrictEqual([
      "attempt open declares .bdk/changes/<id>/dispatch/, which the file table does not name it for",
      "attempt open: **Writes:** .bdk/changes/<id>/attempts/ differs from writes[] .bdk/changes/<id>/attempts/, .bdk/changes/<id>/dispatch/",
    ]);
  });

  it("fails on a **Writes:** line that differs from writes[]", () => {
    const seeded = new Map(writes);
    seeded.set("done", [".bdk/changes/<id>/log/", ".bdk/.machine/"]);
    expect(problems(stateSpec, commands, seeded)).toStrictEqual([
      "done: **Writes:** .bdk/changes/<id>/log/, .bdk/.machine/ differs from writes[] .bdk/changes/<id>/log/, .bdk/changes/<id>/plan/index.md, .bdk/changes/<id>/design/index.md, .bdk/.machine/",
    ]);
  });

  it("fails on source user from another writer", () => {
    const seeded = stateSpec.replace("`change park` (`kernel`)", "`change park` (`user`)");
    expect(problems(seeded, commands, writes)).toStrictEqual([
      "entry type question: source user stamped by change park",
    ]);
  });
});
