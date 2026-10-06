// What the evidence use cases work on: the store, git for the work-tree file
// list and the author, the clock, the settings for `policy.evidence`, and the
// agent registry for the agent working on a ticket.
import type { Clock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { RegistryOpener, Store } from "../../shared/store/index.ts";

export interface EvidenceDeps {
  readonly store: Store;
  readonly git: Git;
  readonly clock: Clock;
  /** For the agent working on a ticket, whose package a ticket reference names (#133). */
  readonly openRegistry: RegistryOpener;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
  /** Replaces `node:crypto` for ids in tests. */
  readonly random?: () => number;
}
