// Text of `bdk git scope` (design D8): short lines for a model reading a Bash result.

import type { ScopeResult } from "../schema/scope.ts";

function list(title: string, paths: readonly string[]): string {
  return `${title} (${paths.length})${paths.length === 0 ? "" : ":"}\n${paths.map((path) => `  ${path}\n`).join("")}`;
}

/** The range and the files outside the groups; shared by `scope` and `groups`. */
export function renderRange(result: ScopeResult): string {
  const { anchor } = result;
  const from =
    anchor.kind === "round"
      ? `since round ${anchor.round ?? "?"}`
      : `from the merge base with ${result.base}`;
  return (
    `range ${anchor.sha.slice(0, 7)}..${result.head.slice(0, 7)}, ${from}\n` +
    (anchor.fallback === undefined ? "" : `fallback: ${anchor.fallback}\n`) +
    list("binary, in no group", result.binary) +
    list("deleted", result.deleted) +
    list("dirty, not in the range", result.dirty)
  );
}

export function renderScope(result: ScopeResult): string {
  return renderRange(result) + list("files", result.files);
}
