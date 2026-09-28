// The archive prune (`kernel-state`, Pruned index; V1-9, T23-D53): the files
// of `dispatch/` and `reports/` of an archived Change give way to one
// `pruned.md` per directory naming each removed file's hash and size, so
// every hash a manifest or an entry names stays checkable. It lives in
// `shared/store` so `change close` (T30) calls it without a slice edge.
import { createHash } from "node:crypto";
import { join } from "node:path";

import { readDocument, writeDocument } from "./state/documents.ts";
import type { Store } from "./store.ts";

const DIRS = ["dispatch", "reports"] as const;
const INDEX = "pruned.md";

interface PrunedFile {
  readonly path: string;
  readonly hash: string;
  readonly bytes: number;
}

/**
 * Prunes `dispatch/` and `reports/` of the Change at `changeDir` and answers
 * the directories it wrote an index in. A directory with nothing but its
 * index is left alone, so a second run writes nothing; files added after a
 * prune join the existing index.
 */
export function pruneChange(store: Store, changeDir: string, now: string): string[] {
  const written: string[] = [];
  for (const dir of DIRS) {
    const path = join(changeDir, dir);
    const names = store.list(path).filter((name) => name !== INDEX && !name.endsWith("/"));
    if (names.length === 0) continue;
    const earlier = readDocument(store, join(path, INDEX));
    const kept =
      earlier !== undefined && "data" in earlier
        ? (earlier.data.files as PrunedFile[]).filter((file) => !names.includes(file.path))
        : [];
    const removed = names.map((name): PrunedFile => {
      const bytes = store.readBytes(join(path, name)) ?? new Uint8Array();
      const hash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      return { path: name, hash, bytes: bytes.byteLength };
    });
    writeDocument(store, join(path, INDEX), {
      data: {
        schema: 1,
        dir,
        at: now,
        files: [...kept, ...removed].sort((a, b) => (a.path < b.path ? -1 : 1)),
      },
      body: "",
    });
    for (const name of names) store.remove(join(path, name));
    written.push(dir);
  }
  return written;
}
