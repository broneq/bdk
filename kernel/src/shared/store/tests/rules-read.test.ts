// The `rules-read` stamp of an attempt record (`kernel-state`, Attempt record;
// T23-D28): stamped once, kept on later calls, and valid through a rebuild.
import { describe, expect, it } from "vitest";

import {
  memoryStore,
  openAttempts,
  openIndex,
  readAttempts,
  rebuildChange,
  stampRulesRead,
  writeDocument,
} from "../index.ts";
import type { ChangeLocation, Store } from "../index.ts";
import { change } from "../state/tests/examples.ts";

const ROOT = "/repo";
const CHANGE = "2026-09-25-login";
const DIR = `${ROOT}/.bdk/changes/${CHANGE}`;
const LIVE: ChangeLocation = { id: CHANGE, dir: DIR, archived: false };
const TICKET = "A-7f3k9m2q";
const FIRST = "2026-09-25T10:00:41.000Z";
const LATER = "2026-09-25T10:05:00.000Z";

function withAttempt(): Store {
  const store = memoryStore();
  writeDocument(store, `${DIR}/change.md`, { data: { ...change, id: CHANGE }, body: "" });
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${TICKET}.md`, {
    data: {
      schema: 1,
      ticket: TICKET,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: "Ada <ada@example.com>",
    },
    body: "",
  });
  return store;
}

const rulesRead = (store: Store) => readAttempts(store, DIR)[0]?.data["rules-read"];

describe("stampRulesRead", () => {
  it("stamps the first call into the attempt record", () => {
    const store = withAttempt();
    expect(stampRulesRead(store, DIR, TICKET, FIRST)).toBe(FIRST);
    expect(rulesRead(store)).toBe(FIRST);
  });

  it("keeps the first time on a repeated call", () => {
    const store = withAttempt();
    stampRulesRead(store, DIR, TICKET, FIRST);
    expect(stampRulesRead(store, DIR, TICKET, LATER)).toBe(FIRST);
    expect(rulesRead(store)).toBe(FIRST);
  });

  it("answers undefined for a ticket without a record and writes nothing", () => {
    const store = withAttempt();
    expect(stampRulesRead(store, DIR, "A-00000000", FIRST)).toBeUndefined();
    expect(rulesRead(store)).toBeUndefined();
  });

  it("leaves a stamped record valid for a rebuild of the index", async () => {
    const store = withAttempt();
    stampRulesRead(store, DIR, TICKET, FIRST);
    const index = await openIndex(store, ROOT, { memory: true });
    rebuildChange(index, LIVE);
    expect(openAttempts(index, CHANGE).map((attempt) => attempt.ticket)).toEqual([TICKET]);
    expect(rulesRead(store)).toBe(FIRST);
  });
});
