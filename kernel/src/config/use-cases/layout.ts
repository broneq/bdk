// The layout of the project at `root`, read through the store.
import { join } from "node:path";

import type { Store } from "../../shared/store/index.ts";
import { classifyLayout, V2_MARKERS } from "../domain/layout.ts";
import type { LayoutState } from "../domain/layout.ts";

export function detectLayout(store: Store, root: string): LayoutState {
  return classifyLayout({
    bdk: store.isDirectory(join(root, ".bdk")),
    present: V2_MARKERS.filter((marker) => store.exists(join(root, marker))),
  });
}
