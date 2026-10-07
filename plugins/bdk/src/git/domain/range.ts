// The range of a review round (spec `bdk-cli/git`, "Scope of a review round", "Round record";
// design D3, D4): parsing git's `-z` output and choosing the round to anchor at.

import { byCodeUnit } from "./pack.ts";

/** Paths of a NUL-terminated git listing, sorted and without duplicates. */
export function nulPaths(output: string): string[] {
  return [...new Set(output.split("\0").filter((path) => path !== ""))].sort(byCodeUnit);
}

/** The changed paths of `git diff --numstat -z --no-renames`, split into text and binary. */
export function numstat(output: string): { readonly text: string[]; readonly binary: string[] } {
  const text: string[] = [];
  const binary: string[] = [];
  for (const record of output.split("\0")) {
    const match = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(record);
    if (match === null) continue;
    const [, added, removed, path = ""] = match;
    (added === "-" && removed === "-" ? binary : text).push(path);
  }
  return { text: text.sort(byCodeUnit), binary: binary.sort(byCodeUnit) };
}

/** The numbers of the `round-<N>` directories among `entries`, highest first. */
export function roundNumbers(
  entries: readonly { readonly name: string; readonly dir: boolean }[],
): number[] {
  return entries
    .filter((entry) => entry.dir)
    .flatMap((entry) => {
      const match = /^round-([1-9]\d*)$/.exec(entry.name);
      return match?.[1] === undefined ? [] : [Number(match[1])];
    })
    .sort((a, b) => b - a);
}

/** The commit a round record names: its `head`, a full hexadecimal object name. */
export function recordHead(text: string): string | undefined {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  const head = (data as { head?: unknown } | null)?.head;
  return typeof head === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(head)
    ? head
    : undefined;
}
