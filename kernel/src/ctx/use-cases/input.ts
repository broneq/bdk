// What the `ctx` use cases work on: the plugin files, the settings registry
// and, for `ctx skill`, where the layers are and what is installed.
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";

/** What the composition root provides. */
export interface CtxDeps {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}

/** The command adds where the layers are and the `PATH` lookup. */
export interface CtxInput extends CtxDeps {
  readonly globalDir: string;
  readonly projectRoot: string;
  which(name: string): string | undefined;
}
