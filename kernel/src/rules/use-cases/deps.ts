// What the rules use cases work on: the store, the index opener and the clock
// for the ticket and its stamp, the plugin root and the settings registry for
// the rule texts.
import type { Clock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { IndexOpener, RegistryOpener, Store } from "../../shared/store/index.ts";

export interface RulesDeps {
  readonly store: Store;
  readonly git: Git;
  readonly openIndex: IndexOpener;
  /** For the agent working on a ticket, whose package a ticket reference names (#133). */
  readonly openRegistry: RegistryOpener;
  readonly clock: Clock;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}
