// What the subagent-git guard counts as a git history change (spec `bdk-cli/hooks`, "Git history
// changes"; design D5): the table of git subcommands and forms that make a commit or move,
// create or delete a ref. Pure: the Bash command text in, the first matching `git <subcommand>`
// (or undefined) out.

import { basename, commandWords, readCommands } from "./shell.ts";

/** Subcommands that change history in every form. */
const ALWAYS = new Set([
  "commit",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "reset",
  "am",
  "pull",
  "push",
  "update-ref",
  "replace",
  "filter-branch",
  "filter-repo",
]);

/** git's global options that take the next word as their value. */
const GLOBAL_VALUE_OPTIONS = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
]);

/** The options of a subcommand, split into long names and short letters, and its operands. */
interface Parsed {
  readonly long: ReadonlySet<string>;
  readonly short: ReadonlySet<string>;
  readonly operands: readonly string[];
}

/**
 * Reads the words after a subcommand. Options in `values` (long `--name` or short `-x`) take the
 * next word as their value unless it is attached (`--name=value`, `-xvalue`); everything after
 * `--` is an operand.
 */
function parse(words: readonly string[], values: ReadonlySet<string> = new Set()): Parsed {
  const long = new Set<string>();
  const short = new Set<string>();
  const operands: string[] = [];
  for (let at = 0; at < words.length; at += 1) {
    const word = words[at] ?? "";
    if (word === "--") {
      operands.push(...words.slice(at + 1));
      break;
    }
    if (word.startsWith("--")) {
      const [name = word] = word.split("=", 1);
      long.add(name);
      if (!word.includes("=") && values.has(name)) at += 1;
    } else if (word.startsWith("-") && word.length > 1) {
      for (let i = 1; i < word.length; i += 1) {
        const letter = word[i] ?? "";
        short.add(letter);
        if (values.has(`-${letter}`)) {
          if (i === word.length - 1) at += 1;
          break;
        }
      }
    } else {
      operands.push(word);
    }
  }
  return { long, short, operands };
}

const has = (parsed: Parsed, short: string, long: readonly string[]): boolean =>
  short.split("").some((letter) => parsed.short.has(letter)) ||
  long.some((name) => parsed.long.has(name));

const LISTING_VALUES = ["--contains", "--no-contains", "--merged", "--no-merged", "--points-at"];

function branchChanges(rest: readonly string[]): boolean {
  const parsed = parse(
    rest,
    new Set([...LISTING_VALUES, "--sort", "--format", "-u", "--set-upstream-to"]),
  );
  if (has(parsed, "l", ["--list", "--show-current"])) return false;
  const writes = has(parsed, "dDmMcCfu", [
    "--delete",
    "--move",
    "--copy",
    "--force",
    "--set-upstream-to",
    "--unset-upstream",
    "--edit-description",
  ]);
  return writes || parsed.operands.length > 0;
}

function tagChanges(rest: readonly string[]): boolean {
  const parsed = parse(rest, new Set([...LISTING_VALUES, "--sort", "--format", "-m", "-F", "-u"]));
  if (has(parsed, "lv", ["--list", "--verify"])) return false;
  const writes = has(parsed, "dasfmFu", [
    "--delete",
    "--annotate",
    "--sign",
    "--force",
    "--message",
    "--file",
    "--local-user",
  ]);
  return writes || parsed.operands.length > 0;
}

/** A refspec operand of `git fetch` that writes a local ref other than a remote-tracking one. */
function fetchesIntoLocalRef(operand: string): boolean {
  const colon = operand.indexOf(":");
  if (colon === -1) return false;
  const destination = operand.slice(colon + 1);
  return destination !== "" && !destination.startsWith("refs/remotes/");
}

/** Whether `git <subcommand> <rest...>` changes history, by the spec's table. */
function changes(subcommand: string, rest: readonly string[]): boolean {
  // Exact words only: `-h` inside a cluster may be another option's value (`commit -mh`).
  if (rest.includes("-h") || rest.includes("--help")) return false;
  if (subcommand === "push" && (rest.includes("-n") || rest.includes("--dry-run"))) return false;
  const options = parse(rest);
  if (ALWAYS.has(subcommand)) return true;
  const next = rest[0];
  switch (subcommand) {
    case "stash":
      return next !== "list" && next !== "show";
    case "branch":
      return branchChanges(rest);
    case "tag":
      return tagChanges(rest);
    case "checkout":
      return has(options, "bBt", ["--orphan", "--track"]);
    case "switch":
      return has(options, "cCt", ["--create", "--force-create", "--orphan", "--track"]);
    case "fetch":
      return options.operands.some(fetchesIntoLocalRef);
    case "worktree":
      return next === "add" && has(parse(rest.slice(1)), "bB", []);
    case "notes": {
      const [action] = parse(rest, new Set(["--ref"])).operands;
      return action !== undefined && !["list", "show", "get-ref"].includes(action);
    }
    case "reflog":
      return next === "expire" || next === "delete";
    case "symbolic-ref": {
      const parsed = parse(rest, new Set(["-m"]));
      return has(parsed, "d", ["--delete"]) || parsed.operands.length >= 2;
    }
    default:
      return false;
  }
}

/** `git <subcommand>` of the first simple command in `command` that changes history. */
export function historyChange(command: string): string | undefined {
  for (const simple of readCommands(command)) {
    const words = commandWords(simple);
    if (basename(words[0] ?? "") !== "git") continue;
    let at = 1;
    while (at < words.length) {
      const word = words[at] ?? "";
      if (GLOBAL_VALUE_OPTIONS.has(word)) at += 2;
      else if (word.startsWith("-")) at += 1;
      else break;
    }
    const subcommand = words[at];
    if (subcommand !== undefined && changes(subcommand, words.slice(at + 1))) {
      return `git ${subcommand}`;
    }
  }
  return undefined;
}
