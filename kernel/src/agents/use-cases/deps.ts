// What the agents use cases work on: the store, the clock, the settings
// registry and plugin files for `agents.*`, the index opener for the ledger
// entries of `--affected-by`, and the registry opener.
import type { Clock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { IndexOpener, RegistryOpener, Store } from "../../shared/store/index.ts";

export interface AgentsDeps {
  readonly store: Store;
  readonly clock: Clock;
  readonly settings: ConfigRegistry;
  readonly pluginRoot: string;
  readonly openIndex: IndexOpener;
  readonly openRegistry: RegistryOpener;
  /** Replaces the timer of `agents wait` in tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}
