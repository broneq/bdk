// What every `config` use case works on. The resolution and the refusal of a
// configuration with problems are shared with every slice (`shared/config`).
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import type { Store } from "../../shared/store/index.ts";

export {
  displayPath,
  resolveOrRefuse as resolve,
  schemaCommand,
} from "../../shared/config/index.ts";
export type { Resolved } from "../../shared/config/index.ts";

interface ConfigSources {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}

/** What the composition root provides. */
export interface ConfigDeps extends ConfigSources {
  /** `config set` asks it which BDK paths are ignored already. */
  readonly git: Git;
}

/** The command adds where the layers are. */
export interface ConfigInput extends ConfigSources {
  readonly globalDir: string;
  readonly projectRoot: string;
}

export { isRefusal } from "../../shared/refusal/index.ts";
