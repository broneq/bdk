// Step 1 of the pipeline: the longest `argv` prefix that names a record.
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import type { CommandIndex, CommandRecord } from "./record.ts";

export interface Resolved {
  readonly record: CommandRecord;
  readonly rest: readonly string[];
}

export function resolve(index: CommandIndex, argv: readonly string[]): Resolved | undefined {
  for (let length = 3; length >= 1; length--) {
    const words = argv.slice(0, length);
    if (words.length < length) continue;
    const record = index.commands.find((candidate) => sameWords(candidate.argv, words));
    if (record !== undefined) return { record, rest: argv.slice(length) };
  }
  return undefined;
}

export function unknownCommand(index: CommandIndex, argv: readonly string[]): Refusal {
  const words = argv.filter((token) => !token.startsWith("--"));
  if (words.length === 0)
    return refuse("input/unknown-command", "no command given", ["bdk --help"]);
  const closest = closestCommand(index, words);
  const typed = words.slice(0, closest.argv.length).join(" ");
  return refuse(
    "input/unknown-command",
    `bdk ${typed} is not a command; the closest is bdk ${closest.argv.join(" ")}`,
    ["bdk --help", `bdk ${closest.argv.join(" ")} --help`],
  );
}

/** The group word weighs first, so a typo in it never lands in another group. */
function closestCommand(index: CommandIndex, words: readonly string[]): CommandRecord {
  let best: CommandRecord | undefined;
  let bestScore: readonly [number, number] = [Infinity, Infinity];
  for (const record of index.commands) {
    const [group = "", ...verbs] = record.argv;
    const score = [
      levenshtein(words[0] ?? "", group),
      levenshtein(words.slice(1, record.argv.length).join(" "), verbs.join(" ")),
    ] as const;
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      [best, bestScore] = [record, score];
    }
  }
  if (best === undefined) throw new Error("the command index is empty");
  return best;
}

function sameWords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((word, i) => word === b[i]);
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
