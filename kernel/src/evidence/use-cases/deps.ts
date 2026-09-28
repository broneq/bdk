// What the evidence use cases work on: the store, git for the work-tree file
// list and the author, the clock, and the settings for `policy.evidence`.
import type { Clock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { Store } from "../../shared/store/index.ts";

export interface EvidenceDeps {
  readonly store: Store;
  readonly git: Git;
  readonly clock: Clock;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
  /** Replaces `node:crypto` for ids in tests. */
  readonly random?: () => number;
}
