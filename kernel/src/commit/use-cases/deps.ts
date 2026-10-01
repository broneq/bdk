// `commit` works on what the part commands work on: the store, git, the
// index, the clock, the plugin files and the settings registry.
import type { PartDeps } from "../../part/index.ts";
import type { LockWait } from "../../shared/store/index.ts";

export type CommitDeps = PartDeps & {
  /** How `commit` waits for another kernel's commit; the process's own by default. */
  readonly commitLock?: LockWait;
};
