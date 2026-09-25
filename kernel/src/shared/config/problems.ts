// One configuration error, before it becomes a refusal: every error names the
// key, the layer and the file (`kernel-settings`, Registry and consumers).
import type { Rule } from "../refusal/index.ts";
import type { LayerName } from "./layers.ts";

export interface ConfigProblem {
  readonly rule: Extract<Rule, "policy/unknown-config-key" | "policy/config-invalid">;
  readonly key: string;
  readonly layer: LayerName;
  /** The layer file; absent for the default layer. */
  readonly path?: string;
  readonly message: string;
}
