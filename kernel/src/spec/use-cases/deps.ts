// What the spec use cases work on: the store, the settings for
// `spec.normative-word`, and the review gate, which the composition root binds
// to the graph's because `spec` is a leaf (T30-D7, D9).
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Store } from "../../shared/store/index.ts";

export interface SpecDeps {
  readonly store: Store;
  readonly settings: ConfigRegistry;
  readonly pluginRoot: string;
  /** A refusal unless the Change's `gate:review` is done (`policy/gate-not-ready`). */
  readonly reviewGate: (change: ActiveChange, globalDir: string) => Promise<Refusal | undefined>;
}
