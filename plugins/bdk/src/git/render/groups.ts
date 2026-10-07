// Text of `bdk git groups` (design D8).

import type { GroupsResult } from "../schema/groups.ts";
import { renderRange } from "./scope.ts";

export function renderGroups(result: GroupsResult): string {
  const groups = result.groups.map((group) => {
    const what = group.part === undefined ? "" : `part ${group.part}, `;
    const count = `${group.files.length} file${group.files.length === 1 ? "" : "s"}`;
    return `group ${group.id} (${what}${count})\n${group.files.map((path) => `  ${path}\n`).join("")}`;
  });
  return (
    renderRange(result) +
    (groups.length === 0 ? "no changed text file, no group\n" : groups.join(""))
  );
}
