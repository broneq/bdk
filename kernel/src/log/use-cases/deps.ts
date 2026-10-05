// What the log use cases work on: the store, git for the author, the index
// and agent registry openers, the clock and the settings registry, all
// injected so unit tests need no disk or git.
import type { Clock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { IndexDb, IndexOpener, RegistryOpener, Store } from "../../shared/store/index.ts";
import { refreshChange, withIndex } from "../../shared/store/index.ts";

export interface LogDeps {
  readonly store: Store;
  readonly git: Git;
  readonly openIndex: IndexOpener;
  /** For the agent working on a ticket, whose package a ticket reference names (#133). */
  readonly openRegistry: RegistryOpener;
  readonly clock: Clock;
  /** For `policy.verifier` (P8), which `log add` reads under a verifier ticket. */
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
  /** Replaces `node:crypto` for ids in tests. */
  readonly random?: () => number;
}

/** Opens the index with the active Change refreshed; true in `refreshed` when the slow path ran. */
export function withChangeIndex<T>(
  deps: LogDeps,
  change: ActiveChange,
  work: (index: IndexDb, refreshed: boolean) => T | Promise<T>,
): Promise<T> {
  return withIndex(deps.openIndex, deps.store, change.projectRoot, (index) => {
    const refreshed = refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    return work(index, refreshed);
  });
}
