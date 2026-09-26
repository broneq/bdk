// What the `hooks` use cases work on.
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";

/** What the composition root provides. */
export interface HooksDeps {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}
