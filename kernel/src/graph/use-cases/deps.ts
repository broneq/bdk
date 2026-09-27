// What the graph use cases work on: the log slice's dependencies, the plugin
// files, the settings registry and the kind registry, which a test replaces
// to add a kind (`kernel-pipeline`, Kind extensibility).
import type { KindRegistry } from "../domain/kinds/index.ts";
import type { LogDeps } from "../../log/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";

export interface GraphDeps extends LogDeps {
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
  /** Defaults to the shipped kinds. */
  readonly kinds?: KindRegistry;
}
