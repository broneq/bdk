// Reads one Change into the `ChangeView` the kinds and the engine work on:
// files on demand through `shared/store`, each read and schema-checked once.
import { join } from "node:path";

import type { ChangeView, FileFacts, GraphEntry } from "../domain/kinds/index.ts";
import { KernelRefusal } from "../../shared/refusal/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { EntryRow, Store } from "../../shared/store/index.ts";
import type { Profile } from "../../shared/vocabulary/index.ts";

export interface ViewInput {
  readonly store: Store;
  readonly id: string;
  readonly dir: string;
  readonly projectRoot: string;
  readonly kind: string;
  readonly profile: Profile;
  readonly entries: readonly EntryRow[];
}

export function changeView(input: ViewInput): ChangeView {
  const { store, dir } = input;
  const files = new Map<string, FileFacts | undefined>();
  const byId = new Map(input.entries.map((entry) => [entry.id, entry]));
  const file = (path: string): FileFacts | undefined => {
    if (files.has(path)) return files.get(path);
    const facts = readFacts(store, join(dir, path));
    files.set(path, facts);
    return facts;
  };
  return {
    id: input.id,
    kind: input.kind,
    profile: input.profile,
    entries: input.entries,
    file,
    list: (sub) => store.list(join(dir, sub)).filter((name) => !name.endsWith("/")),
    reportStatus: (entry: GraphEntry) => {
      const row = byId.get(entry.id);
      if (row === undefined) return undefined;
      const data = documentData(store, join(input.projectRoot, row.path));
      const report = data?.report;
      if (typeof report !== "string") return undefined;
      const status = documentData(store, join(dir, report))?.status;
      return typeof status === "string" ? status : undefined;
    },
  };
}

function readFacts(store: Store, path: string): FileFacts | undefined {
  const text = store.read(path);
  if (text === undefined) return undefined;
  const bytes = Buffer.byteLength(text);
  try {
    const document = readDocument(store, path);
    if (document === undefined) return undefined;
    const blank = document.body.trim() === "";
    return "data" in document ? { bytes, blank, data: document.data } : { bytes, blank };
  } catch (error) {
    if (!(error instanceof KernelRefusal)) throw error;
    return { bytes, blank: text.trim() === "", invalid: error.refusal.why };
  }
}

function documentData(store: Store, path: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const document = readDocument(store, path);
    return document !== undefined && "data" in document ? document.data : undefined;
  } catch (error) {
    if (error instanceof KernelRefusal) return undefined;
    throw error;
  }
}
