// `bdk log resolve <id> <status>`: one of the mutations `kernel-state`
// allows. The entry's frontmatter is rewritten in place (or, for
// `superseded`, the `--by` entry gains `supersedes`) and the reason is
// appended to the rewritten entry's body.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findEntry, readDocument, writeDocument } from "../../shared/store/index.ts";
import type { EntryRow } from "../../shared/store/index.ts";
import { allowedMoves, withResolution } from "../domain/entry.ts";
import type { ResolveResult } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

export interface ResolveInput {
  readonly id: string;
  readonly status: string;
  readonly by?: string;
  readonly reason?: string;
}

export function resolveEntry(
  deps: LogDeps,
  change: ActiveChange,
  input: ResolveInput,
): Promise<ResolveResult | Refusal> {
  if (input.status === "superseded" && input.by === undefined) {
    return Promise.resolve(
      refuse("input/missing-argument", "superseded needs --by <id>, the superseding entry", [
        `bdk log resolve ${input.id} superseded --by <id>`,
      ]),
    );
  }
  return withChangeIndex(deps, change, (index) => {
    const entry = findEntry(index, change.id, bare(change, input.id));
    if (entry === undefined) return notFound(change, input.id);
    const moves = allowedMoves(entry.type, entry.status);
    if (!moves.includes(input.status)) {
      return refuse(
        "policy/invalid-transition",
        entry.type === "transition"
          ? `${entry.id} is a transition; its status never changes`
          : `${entry.id} is ${entry.status}; allowed from there: ${moves.length === 0 ? "nothing" : moves.join(", ")}`,
        ["bdk log show " + entry.id, "bdk log add ... --supersedes " + entry.id],
      );
    }
    const at = deps.clock.now();
    if (input.status !== "superseded") {
      const done = rewrite(
        deps,
        change,
        entry,
        (data) => ({ ...data, status: input.status }),
        at,
        input,
      );
      return done ? result(input, entry.id) : notFound(change, input.id);
    }
    const by = findEntry(index, change.id, bare(change, input.by ?? ""));
    if (by === undefined) return notFound(change, input.by ?? "");
    if (by.id === entry.id || by.supersedes !== undefined) {
      return refuse(
        "policy/invalid-transition",
        by.id === entry.id
          ? `${entry.id} cannot supersede itself`
          : `${by.id} already supersedes ${by.supersedes ?? ""}; an entry supersedes one entry`,
        ["bdk log add ... --supersedes " + entry.id],
      );
    }
    const done = rewrite(
      deps,
      change,
      by,
      (data) => ({ ...data, supersedes: entry.id }),
      at,
      input,
    );
    return done ? result(input, by.id) : notFound(change, by.id);
  });
}

/** A bare id, or one qualified with the active Change; anything else never matches. */
function bare(change: ActiveChange, id: string): string {
  const prefix = `${change.id}/`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function notFound(change: ActiveChange, id: string): Refusal {
  return refuse("input/not-found", `${id} names no entry of ${change.id}`, ["bdk log list"]);
}

function rewrite(
  deps: LogDeps,
  change: ActiveChange,
  entry: EntryRow,
  update: (data: Readonly<Record<string, unknown>>) => Record<string, unknown>,
  at: string,
  input: ResolveInput,
): boolean {
  const path = join(change.projectRoot, entry.path);
  const document = readDocument(deps.store, path);
  if (document === undefined || !("data" in document)) return false;
  writeDocument(deps.store, path, {
    data: update(document.data),
    body: withResolution(document.body, input.status, at, input.reason),
  });
  return true;
}

function result(input: ResolveInput, record: string): ResolveResult {
  return {
    entry: input.id,
    status: input.status,
    ...(input.by === undefined ? {} : { by: input.by }),
    record,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  };
}
