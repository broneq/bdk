// What the change use cases work on: the log slice's dependencies plus the
// configuration registry, for the overridden keys `change new` records.
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { LogDeps } from "../../log/index.ts";

export interface ChangeDeps extends LogDeps {
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}
