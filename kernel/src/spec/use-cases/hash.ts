// The living spec files whose body no longer hashes to their `bdk-merge-hash`,
// or that have none (`kernel-state`, Living spec file; T30-D13): `doctor`
// reports them, the merge refuses them.
import { join, relative } from "node:path";

import type { Store } from "../../shared/store/index.ts";
import { bodyHash, livingOf } from "./living.ts";
import { specsDir } from "./files.ts";

export interface HashFinding {
  /** Relative to the project root. */
  readonly path: string;
  readonly message: string;
}

export function mergeHashFindings(store: Store, projectRoot: string): HashFinding[] {
  const found: HashFinding[] = [];
  const visit = (dir: string): void => {
    for (const name of store.list(dir)) {
      const path = join(dir, name);
      if (name.endsWith("/")) {
        visit(path);
        continue;
      }
      if (name !== "spec.md") continue;
      const living = livingOf(store.read(path) ?? "");
      const shown = relative(projectRoot, path);
      if (living.hash === undefined) {
        found.push({
          path: shown,
          message: `${shown} has no bdk-merge-hash: it was written outside spec merge`,
        });
      } else if (living.hash !== bodyHash(living.body)) {
        found.push({
          path: shown,
          message: `${shown} was edited outside spec merge: content hash differs from bdk-merge-hash`,
        });
      }
    }
  };
  visit(specsDir(projectRoot));
  return found;
}
