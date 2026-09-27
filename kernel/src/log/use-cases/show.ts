// `bdk log show <id>`: one entry in full. A qualified id reads the named
// Change, archived or not; the index answers the derived status and
// `supersededBy`, the file the body.
import { join } from "node:path";

import { parseReference } from "../../shared/ids/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findChange, findEntry, readDocument, refreshChange } from "../../shared/store/index.ts";
import { entryView } from "../domain/entry.ts";
import type { ShownEntry } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

export function showEntry(
  deps: LogDeps,
  change: ActiveChange,
  id: string,
): Promise<ShownEntry | Refusal> {
  const reference = parseReference(id);
  if (!reference?.id.startsWith("L-")) {
    return Promise.resolve(
      refuse("input/invalid-argument", `${id} is not an entry id`, [
        "bdk log show L-xxxxxxxx",
        "bdk log show <changeId>/L-xxxxxxxx",
      ]),
    );
  }
  const changeId = reference.changeId ?? change.id;
  const notFound = (why: string): Refusal =>
    refuse("input/not-found", why, ["bdk log list", "bdk change list --all"]);
  return withChangeIndex(deps, change, (index) => {
    if (changeId !== change.id) {
      const location = findChange(deps.store, change.projectRoot, changeId);
      if (location === undefined) return notFound(`no Change ${changeId}`);
      refreshChange(index, location);
    }
    const row = findEntry(index, changeId, reference.id);
    if (row === undefined) return notFound(`${id} names no entry of ${changeId}`);
    const document = readDocument(deps.store, join(change.projectRoot, row.path));
    if (document === undefined || !("data" in document)) {
      return notFound(`${row.path} disappeared while it was read`);
    }
    return {
      entry: { ...entryView(document.data, row.status), body: document.body, path: row.path },
      ...(row.supersededBy === undefined ? {} : { supersededBy: row.supersededBy }),
    };
  });
}
