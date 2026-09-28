// The resolved `policy.verifier` lists (P8): `log add` downgrades a verifier
// blocker outside the blocking categories, and `dispatch build` puts both
// lists in a verifier's package.
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { verifierModule } from "../config.ts";
import type { LogDeps } from "./deps.ts";

export interface VerifierCategory {
  readonly id: string;
  readonly description: string;
}

export interface VerifierPolicy {
  readonly blocking: readonly VerifierCategory[];
  readonly notAFail: readonly VerifierCategory[];
}

export function verifierPolicy(
  deps: LogDeps,
  change: ActiveChange,
  globalDir: string,
): VerifierPolicy | Refusal {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot: change.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  if ("refused" in resolved) return resolved;
  const policy = verifierModule.schema.parse(
    (resolved.value.policy as Record<string, unknown> | undefined)?.verifier,
  );
  return { blocking: policy["blocking-categories"], notAFail: policy["not-a-fail"] };
}
