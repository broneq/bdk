// The resolved `policy.verifier` lists (P8): `log add` downgrades a verifier
// blocker outside the blocking categories, `dispatch build` puts both lists
// in a verifier's package, and `ctx skill` in the context of the skills that
// check a draft or triage against them (T42).
import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Resolved } from "../../shared/config/index.ts";
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
  return verifierLists(resolved);
}

/** Both lists of an already resolved configuration. */
export function verifierLists(resolved: Resolved): VerifierPolicy {
  const policy = moduleValue(verifierModule, resolved.value);
  return { blocking: policy["blocking-categories"], notAFail: policy["not-a-fail"] };
}
