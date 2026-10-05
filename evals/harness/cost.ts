// The cost of a run as promptfoo reports it, the cap of one session, and the
// projection a probe prints before a full series (design D-10).

/** A single session's cap (`max_budget_usd`), so one runaway run stops on its own. */
export const DEFAULT_RUN_CAP_USD = 15;

export interface Projection {
  readonly perCell: Readonly<Record<string, number>>;
  readonly total: number;
}

export function projection(
  probeCostPerCell: Readonly<Record<string, number>>,
  runsPerCell: number,
): Projection {
  const perCell = Object.fromEntries(
    Object.entries(probeCostPerCell).map(([cell, cost]) => [cell, cost * runsPerCell]),
  );
  const total = Object.values(perCell).reduce((sum, cost) => sum + cost, 0);
  return { perCell, total };
}

interface ProviderResult {
  readonly response?: {
    readonly cost?: number;
    readonly metadata?: { readonly modelUsage?: Record<string, { readonly costUSD?: number }> };
  };
}

/** The cost a promptfoo result reports (evals/README.md, Provider facts). */
export function costOf(result: ProviderResult): number {
  const response = result.response;
  if (typeof response?.cost === "number") return response.cost;
  const usage = response?.metadata?.modelUsage;
  if (usage !== undefined) {
    return Object.values(usage).reduce((sum, model) => sum + (model.costUSD ?? 0), 0);
  }
  throw new Error("the provider result carries no cost");
}
