// Ledger entry files (`kernel-state`, Ledger entry): `log/<ts>-<type>-<id>.md`.
// The id is drawn fresh and drawn again while `log/` already holds it, so two
// writers never need a lock (`kernel-state`, Identifiers).
import { join } from "node:path";

import { newId } from "../../ids/index.ts";
import type { Store } from "../store.ts";
import { writeDocument } from "./documents.ts";

type Data = Readonly<Record<string, unknown>>;

const ATTEMPTS = 16;

function entryFileName(data: Data): string {
  const stamp = String(data.at).replaceAll("-", "").replaceAll(":", "");
  return `${stamp}-${String(data.type)}-${String(data.id)}.md`;
}

export function entryPath(changeDir: string, data: Data): string {
  return join(changeDir, "log", entryFileName(data));
}

export interface WrittenEntry {
  readonly id: string;
  readonly path: string;
  readonly data: Data;
}

/**
 * Validates and writes one entry; `build` receives the id and returns the
 * frontmatter. `random` replaces `node:crypto` in tests.
 */
export function writeEntry(
  store: Store,
  changeDir: string,
  build: (id: string) => Data,
  body: string,
  random?: () => number,
): WrittenEntry {
  const taken = store.list(join(changeDir, "log"));
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const id = newId("L-", random);
    if (taken.some((name) => name.endsWith(`-${id}.md`))) continue;
    const data = build(id);
    const path = entryPath(changeDir, data);
    writeDocument(store, path, { data, body });
    return { id, path, data };
  }
  throw new Error(`no free ledger id in ${changeDir} after ${ATTEMPTS} draws`);
}
