// `bdk git groups`: the scope of a round split into reviewer groups, optionally recorded
// (spec `bdk-cli/git`, "Review groups", "Recording a round"; design D3, D5).

import { resolve } from "node:path";

import { reviewGroups } from "../domain/groups.ts";
import type { GroupsResult } from "../schema/groups.ts";
import { readParts } from "../store/plan.ts";
import { writeRecord } from "../store/rounds.ts";
import type { GitDeps } from "./deps.ts";
import { scope } from "./scope.ts";
import type { ScopeInput } from "./scope.ts";

export interface GroupsInput extends ScopeInput {
  /** The Change's `plan/parts/` directory; absent to group by module. */
  readonly plan?: string | undefined;
  /** The file target of a group. */
  readonly maxFiles: number;
  /** The round directory to write `groups.json` into. */
  readonly record?: string | undefined;
}

export function groups(deps: GitDeps, input: GroupsInput): GroupsResult {
  const parts =
    input.plan === undefined ? undefined : readParts(deps.files, resolve(deps.cwd, input.plan));
  const range = scope(deps, input);
  const result: GroupsResult = {
    ...range,
    groups: reviewGroups(range.files, parts, input.maxFiles),
  };
  if (input.record !== undefined) {
    writeRecord(deps.files, resolve(deps.cwd, input.record), `${JSON.stringify(result)}\n`);
  }
  return result;
}
