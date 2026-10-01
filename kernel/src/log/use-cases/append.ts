// `appendEntry` (design D-6 of T20): the one path by which a ledger entry is
// written. It stamps `id`, `at`, `author`, `source`, `ticket` and, for a
// `learning`, `fingerprint`, deduplicates when asked, and writes the file
// through `shared/store`. `log add` and the `change` slice both call it; the
// transition fields and a `user` or `policy` source come only from `hooks`
// (T24 design D-13).
import { join, relative, sep } from "node:path";

import { authorIdent } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  learningFingerprint,
  listEntries,
  normalise,
  readDocument,
  openPackage,
  writeEntry,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import { entryView, findDuplicate } from "../domain/entry.ts";
import type { AppendResult } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";

export interface EntryDraft {
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  readonly body: string;
  readonly status?: string;
  readonly ticket?: string;
  readonly review?: boolean;
  readonly supersedes?: string;
  readonly severity?: string;
  readonly category?: string;
  readonly options?: readonly string[];
  /** A learning's globs (`log add --applies`). */
  readonly applies?: readonly string[];
  /** A report entry's report file, relative to the Change directory (`log add report`). */
  readonly report?: string;
  /** Kernel-only own fields (`change park`, `change new`, `change resume`, `done`). */
  readonly park?: boolean;
  readonly profile?: string;
  readonly to?: string;
  readonly inputHash?: string;
  /** Kernel-only transition fields (`hooks prompt-expansion`). */
  readonly gate?: string;
  readonly session?: string;
  readonly command?: string;
  readonly skipVerify?: boolean;
  /** Who passed the gate; without it the entry is `kernel`, or `agent:<role>` under a ticket. */
  readonly source?: "user" | "policy";
}

export async function appendEntry(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
  draft: EntryDraft,
  options: { readonly dedupe: boolean },
): Promise<AppendResult | Refusal> {
  let source: string = draft.source ?? "kernel";
  if (draft.ticket !== undefined) {
    const role = openPackage(deps.store, change.projectRoot, change.dir, draft.ticket)?.role;
    if (role === undefined) {
      return refuse(
        "policy/no-open-ticket",
        `${draft.ticket} has no open attempt record with a dispatch package in ${change.id}`,
        [
          "bdk log add ... without --ticket from the main thread",
          "bdk attempt open <loop> <target>",
        ],
      );
    }
    source = `agent:${role}`;
  }
  const fingerprint = draft.type === "learning" ? learningFingerprint(draft.summary) : undefined;

  if (options.dedupe) {
    const existing = findDuplicate(
      { ...draft, ...(fingerprint === undefined ? {} : { fingerprint }) },
      listEntries(index, change.id, { type: draft.type }),
      normalise,
    );
    if (existing !== undefined) {
      const document = readDocument(deps.store, join(change.projectRoot, existing.path));
      if (document !== undefined && "data" in document) {
        return {
          entry: entryView(document.data, existing.status),
          path: existing.path,
          deduplicated: true,
        };
      }
    }
  }

  const author = await authorIdent(deps.git, change.projectRoot);
  const at = deps.clock.now();
  const written = writeEntry(
    deps.store,
    change.dir,
    (id) => ({
      schema: 1,
      id,
      type: draft.type,
      summary: draft.summary,
      status: draft.status ?? "proposed",
      source,
      author,
      at,
      ...(draft.ticket === undefined ? {} : { ticket: draft.ticket }),
      refs: [...draft.refs],
      ...(draft.supersedes === undefined ? {} : { supersedes: draft.supersedes }),
      ...(draft.review === true ? { review: true } : {}),
      ...(draft.severity === undefined ? {} : { severity: draft.severity }),
      ...(draft.category === undefined ? {} : { category: draft.category }),
      ...(fingerprint === undefined ? {} : { fingerprint }),
      ...(draft.options === undefined ? {} : { options: [...draft.options] }),
      ...(draft.applies === undefined ? {} : { applies: [...draft.applies] }),
      ...(draft.report === undefined ? {} : { report: draft.report }),
      ...(draft.park === true ? { park: true } : {}),
      ...(draft.profile === undefined ? {} : { profile: draft.profile }),
      ...(draft.to === undefined ? {} : { to: draft.to }),
      ...(draft.gate === undefined ? {} : { gate: draft.gate }),
      ...(draft.session === undefined ? {} : { session: draft.session }),
      ...(draft.command === undefined ? {} : { command: draft.command }),
      ...(draft.skipVerify === true ? { "skip-verify": true } : {}),
      ...(draft.inputHash === undefined ? {} : { "input-hash": draft.inputHash }),
    }),
    draft.body,
    deps.random,
  );
  return {
    entry: entryView(written.data, String(written.data.status)),
    path: relative(change.projectRoot, written.path).split(sep).join("/"),
    deduplicated: false,
  };
}
