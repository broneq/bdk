// Which generation of BDK state a project holds: v2 left files under `.bdk/`
// that v3 never writes, and `bdk import` (T32) converts them. `doctor` and
// `hooks session-start` both report it (design D-8 of v3-t13-ctx-content-hooks).

type Layout = "v3" | "v2" | "none";

export const V2_MARKERS = [".bdk/settings.json", ".bdk/runs/", ".bdk/plans/"] as const;

export interface LayoutState {
  readonly layout: Layout;
  /** The V2_MARKERS found, in their order; empty unless the layout is v2. */
  readonly present: readonly string[];
}

/** `present` lists the V2_MARKERS found, in their order. */
export function classifyLayout(state: {
  readonly bdk: boolean;
  readonly present: readonly string[];
}): LayoutState {
  if (!state.bdk) return { layout: "none", present: [] };
  if (state.present.length === 0) return { layout: "v3", present: [] };
  return { layout: "v2", present: state.present };
}
