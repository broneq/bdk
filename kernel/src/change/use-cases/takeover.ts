// `bdk change takeover --close-tickets` (`kernel-cli/change`; T22 design
// D-14): the previous session died with tickets open. Each is closed as
// `not-run` with the body `taken over` (budgets stay; the round's not-run
// counter advances), a kernel transition to the current stage names them,
// and the rebuild of `bdk rebuild` runs for the Change. `previousSession`
// names the session that typed the stage command behind the work (T24 D-15).
import { join } from "node:path";

import { stageResolver } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  listEntries,
  readAttempts,
  readDocument,
  rebuildChanges,
  refreshChange,
  writeDocument,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { TakeoverReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

export function takeover(
  deps: ChangeDeps,
  change: ActiveChange,
  input: { readonly closeTickets: boolean },
): Promise<TakeoverReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const open = readAttempts(deps.store, change.dir).filter(
      (record) => record.data.outcome === undefined,
    );
    if (open.length === 0) {
      return refuse(
        "policy/invalid-transition",
        `${change.id} has no open ticket, so there is nothing to take over`,
        ["bdk rebuild", "bdk change status"],
      );
    }
    const tickets = open.map((record) => record.data.ticket);
    if (!input.closeTickets) {
      return refuse(
        "policy/ticket-open",
        `${tickets.join(", ")} still open in ${change.id}; close them only when the session that opened them is gone`,
        ["bdk change takeover --close-tickets", "bdk attempt list"],
      );
    }
    const opened = open.map((record) => record.data["opened-at"]).sort()[0] ?? "";
    const session = previousSession(deps, change, index, opened);
    const at = deps.clock.now();
    for (const record of open) {
      writeDocument(deps.store, record.path, {
        data: { ...record.data, "closed-at": at, outcome: "not-run" },
        body: "taken over\n",
      });
    }
    const location = { id: change.id, dir: change.dir, archived: false };
    refreshChange(index, location);
    const { stage } = changeFacts(index, change.id, stageResolver(deps));
    const transition = await appendEntry(
      deps,
      change,
      index,
      {
        type: "transition",
        summary: `Change taken over: ${String(tickets.length)} open ticket${tickets.length === 1 ? "" : "s"} closed as not-run`,
        refs: tickets,
        body: "",
        to: stage,
      },
      { dedupe: false },
    );
    if (isRefusal(transition)) return transition;
    const rebuilt = await rebuildChanges({ index, git: deps.git, locations: [location] });
    if (rebuilt.mismatches.length > 0) {
      return refuse("state/trailer-mismatch", rebuilt.mismatches.join("; "), [
        "fix the trailer or the plan part named, then run bdk rebuild",
      ]);
    }
    return {
      change: change.id,
      closedTickets: tickets,
      rebuilt: true,
      ...(session === undefined ? {} : { previousSession: session }),
    };
  });
}

/** The `session` of the latest transition that carries one and is not later than `opened`. */
function previousSession(
  deps: ChangeDeps,
  change: ActiveChange,
  index: IndexDb,
  opened: string,
): string | undefined {
  const candidates = listEntries(index, change.id, { type: "transition" })
    .filter((entry) => entry.at <= opened)
    .reverse();
  for (const entry of candidates) {
    const document = readDocument(deps.store, join(change.projectRoot, entry.path));
    const session =
      document !== undefined && "data" in document ? document.data.session : undefined;
    if (typeof session === "string" && session !== "") return session;
  }
  return undefined;
}
