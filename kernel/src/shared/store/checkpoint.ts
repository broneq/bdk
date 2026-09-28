// The checkpoint core (`kernel-loops`, Checkpoint; design D-11): a pathspec
// commit of the Change directory alone, `chore(bdk): checkpoint <id>`. Every
// caller shares it; only `change checkpoint` turns a skip into its refusal,
// the implicit callers (park, escalation, the end of the ladder, session end)
// report the skip and go on.
import { relative, sep } from "node:path";

import { moduleValue } from "../config/index.ts";
import type { Mapping } from "../config/index.ts";
import { changedPaths, gitInProgress, pathspecCommit } from "../git/index.ts";
import type { Git } from "../git/index.ts";
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import { checkpointModule } from "./config.ts";
import type { Store } from "./store.ts";
import { readAttempts } from "./work.ts";

export type Checkpoint =
  | { readonly done: true; readonly commit: string }
  | { readonly done: false; readonly skipped: string; readonly refusal?: Refusal };

export interface CheckpointInput {
  readonly store: Store;
  readonly git: Git;
  readonly projectRoot: string;
  readonly change: { readonly id: string; readonly dir: string };
  /** The resolved settings; `policy.checkpoint.enabled` is read from them. */
  readonly settings: Readonly<Mapping>;
}

export async function checkpointChange(input: CheckpointInput): Promise<Checkpoint> {
  const { store, git, projectRoot, change } = input;
  if (!moduleValue(checkpointModule, input.settings).enabled) {
    return { done: false, skipped: "policy.checkpoint.enabled is false" };
  }
  const inProgress = gitInProgress(projectRoot);
  if (inProgress !== undefined) {
    return { done: false, skipped: inProgress.why, refusal: inProgress };
  }
  const open = readAttempts(store, change.dir)
    .filter((record) => record.data.outcome === undefined)
    .map((record) => record.data.ticket);
  if (open.length > 0) {
    const why = `ticket${open.length === 1 ? "" : "s"} ${open.join(", ")} ${open.length === 1 ? "is" : "are"} open; a subagent may still be writing`;
    return {
      done: false,
      skipped: why,
      refusal: refuse(
        "policy/ticket-open",
        why,
        open.map((ticket) => `bdk attempt close ${ticket} ok|fail|not-run`),
      ),
    };
  }
  const dir = `${relative(projectRoot, change.dir).split(sep).join("/")}/`;
  if ((await changedPaths(git, projectRoot, [dir])).length === 0) {
    return { done: false, skipped: `nothing under ${dir} changed since the last commit` };
  }
  const result = await pathspecCommit(
    git,
    projectRoot,
    [dir],
    `chore(bdk): checkpoint ${change.id}`,
  );
  if (result.committed) return { done: true, commit: result.commit };
  const why = `a git hook rejected the checkpoint commit: ${result.output}`;
  return {
    done: false,
    skipped: why,
    refusal: refuse("policy/git-hook-failed", why, [
      "fix what the hook reports, then run bdk change checkpoint",
    ]),
  };
}
