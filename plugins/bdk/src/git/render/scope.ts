// Text of `bdk git scope` (design D8): short lines for a model reading a Bash result.

import type { ScopeResult } from "../schema/scope.ts";

/** A heading, a colon when paths follow, and the paths indented. */
function paths(heading: string, list: readonly string[]): string {
  return `${heading}${list.length === 0 ? "" : ":"}\n${list.map((path) => `  ${path}\n`).join("")}`;
}

function list(title: string, files: readonly string[]): string {
  return paths(`${title} (${files.length})`, files);
}

/** The range and the files outside the groups; shared by `scope` and `groups`. */
export function renderRange(result: ScopeResult): string {
  const { anchor } = result;
  const changed = result.files.length + result.binary.length + result.deleted.length;
  const from =
    anchor.kind === "round"
      ? `since round ${anchor.round ?? "?"}`
      : `from the merge base with ${result.base}`;
  return (
    `range ${anchor.sha.slice(0, 7)}..${result.head.slice(0, 7)}, ${from}\n` +
    (anchor.fallback === undefined ? "" : `fallback: ${anchor.fallback}\n`) +
    list("binary, in no group", result.binary) +
    list("deleted", result.deleted) +
    list("dirty, not in the range", result.dirty) +
    paths(
      `test files (${result.tests.length} of ${changed}${result.testsOnly ? ", tests only" : ""})`,
      result.tests,
    )
  );
}

export function renderScope(result: ScopeResult): string {
  return renderRange(result) + list("files", result.files);
}
