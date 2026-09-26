// The doctor finding for a v2 layout; the detection itself belongs to the
// config slice.

export interface LayoutFinding {
  readonly id: "v2-layout";
  readonly level: "warn";
  readonly summary: string;
  readonly repair: "bdk import";
}

/** `present` lists the v2 markers found; undefined when there are none. */
export function layoutFinding(present: readonly string[]): LayoutFinding | undefined {
  if (present.length === 0) return undefined;
  return {
    id: "v2-layout",
    level: "warn",
    summary: `${enumerate(present)} found`,
    repair: "bdk import",
  };
}

function enumerate(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}
