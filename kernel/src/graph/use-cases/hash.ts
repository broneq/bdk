// Input hashes (`kernel-pipeline`, Artifact kinds; design D-4): sha256 over
// `path NUL bytes NUL` per file in path order, so a rename changes it; the
// `review` kind hashes the committed code tree instead.
import { createHash } from "node:crypto";
import { join } from "node:path";

import type { Inputs } from "../domain/kinds/index.ts";
import type { Store } from "../../shared/store/index.ts";

export function inputHasher(
  store: Store,
  changeDir: string,
  codeTree: string | undefined,
): (inputs: Inputs) => string {
  return (inputs) => {
    if ("codeTree" in inputs) return codeTree ?? filesHash(store, changeDir, []);
    return filesHash(store, changeDir, "files" in inputs ? inputs.files : []);
  };
}

function filesHash(store: Store, changeDir: string, files: readonly string[]): string {
  const hash = createHash("sha256");
  for (const path of [...files].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(store.read(join(changeDir, path)) ?? "");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
