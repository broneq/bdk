// The answer of `bdk review plan` (`kernel-cli/review`).
import type { ReviewGroup } from "./groups.ts";

export interface ReviewPlan {
  readonly change: string;
  readonly anchor: {
    readonly kind: "delta" | "full" | "base";
    readonly sha: string;
  };
  readonly head: string;
  readonly range: string;
  readonly dirty: readonly string[];
  readonly measure: {
    readonly files: number;
    readonly added: number;
    readonly removed: number;
    readonly modules: readonly string[];
  };
  readonly groups: readonly ReviewGroup[];
}
