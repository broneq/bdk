// What every `config` use case works on. The resolution and the refusal of a
// configuration with problems are shared with every slice (`shared/config`).
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Store } from "../../shared/store/index.ts";

export {
  displayPath,
  resolveOrRefuse as resolve,
  schemaCommand,
} from "../../shared/config/index.ts";
export type { Resolved } from "../../shared/config/index.ts";

/** What the composition root provides. */
export interface ConfigDeps {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}

/** The command adds where the layers are. */
export interface ConfigInput extends ConfigDeps {
  readonly globalDir: string;
  readonly projectRoot: string;
}

export function isRefusal(outcome: object): outcome is Refusal {
  return "refused" in outcome;
}
