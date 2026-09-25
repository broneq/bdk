// Which generation of BDK state a project holds: v2 left files under `.bdk/`
// that v3 never writes, and `bdk import` (T32) converts them.

type Layout = "v3" | "v2" | "none";

export const V2_MARKERS = [".bdk/settings.json", ".bdk/runs/", ".bdk/plans/"] as const;

interface LayoutFinding {
  readonly id: "v2-layout";
  readonly level: "warn";
  readonly summary: string;
  readonly repair: "bdk import";
}

export interface LayoutReport {
  readonly layout: Layout;
  readonly finding?: LayoutFinding;
}

/** `present` lists the V2_MARKERS found, in their order. */
export function classifyLayout(state: {
  readonly bdk: boolean;
  readonly present: readonly string[];
}): LayoutReport {
  if (!state.bdk) return { layout: "none" };
  if (state.present.length === 0) return { layout: "v3" };
  return {
    layout: "v2",
    finding: {
      id: "v2-layout",
      level: "warn",
      summary: `${enumerate(state.present)} found`,
      repair: "bdk import",
    },
  };
}

function enumerate(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}
