// The ticket queries of `kernel-state`, Attempt record (`package`; T23-D42)
// and Evidence manifest: the active package, the stamp written by each
// `dispatch build`, and the manifests of a ticket and of a part.
import { describe, expect, it } from "vitest";

import {
  activePackage,
  memoryStore,
  openAttempts,
  openIndex,
  openPackage,
  packageRoles,
  partManifests,
  readAttempts,
  readManifests,
  rebuildChange,
  stampPackage,
  ticketManifests,
  writeDocument,
} from "../index.ts";
import type { ChangeLocation, Store } from "../index.ts";
import { change, dispatch, evidence } from "../state/tests/examples.ts";

const ROOT = "/repo";
const CHANGE = "2026-09-25-login";
const REL = `.bdk/changes/${CHANGE}`;
const DIR = `${ROOT}/${REL}`;
const LIVE: ChangeLocation = { id: CHANGE, dir: DIR, archived: false };
const TICKET = "A-7f3k9m2q";
const OTHER = "A-4m8rt2wx";

function seeded(): Store {
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
  for (const role of ["implementer", "runner"]) {
    writeDocument(store, `${DIR}/dispatch/02-3-${role}-${TICKET}.md`, {
      data: {
        ...dispatch,
        ticket: TICKET,
        role,
        report: `${REL}/reports/02-3-${role}-${TICKET}.md`,
      },
      body: "",
    });
  }
  return store;
}

const pkg = (role: string) => `${REL}/dispatch/02-3-${role}-${TICKET}.md`;

describe("stampPackage and activePackage", () => {
  it("answers no active package before any dispatch build stamps one", () => {
    expect(activePackage(seeded(), ROOT, DIR, TICKET)).toBeUndefined();
  });

  it("names the package of the latest stamp, whatever the file order", () => {
    const store = seeded();
    expect(stampPackage(store, DIR, TICKET, pkg("runner"))).toBe(true);
    expect(activePackage(store, ROOT, DIR, TICKET)).toMatchObject({
      role: "runner",
      path: pkg("runner"),
    });
    stampPackage(store, DIR, TICKET, pkg("implementer"));
    expect(activePackage(store, ROOT, DIR, TICKET)).toMatchObject({ role: "implementer" });
    expect(readAttempts(store, DIR)[0]?.data.package).toBe(pkg("implementer"));
  });

  it("writes nothing for a ticket without a record", () => {
    const store = seeded();
    expect(stampPackage(store, DIR, OTHER, pkg("runner"))).toBe(false);
    expect(readAttempts(store, DIR)[0]?.data.package).toBeUndefined();
  });

  it("answers undefined when the stamped package file is gone", () => {
    const store = seeded();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    store.remove(`${ROOT}/${pkg("runner")}`);
    expect(activePackage(store, ROOT, DIR, TICKET)).toBeUndefined();
  });

  it("answers the active package of an open ticket only", () => {
    const store = seeded();
    expect(openPackage(store, ROOT, DIR, TICKET)).toBeUndefined();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    expect(openPackage(store, ROOT, DIR, TICKET)).toMatchObject({ role: "runner" });
    const [record] = readAttempts(store, DIR);
    if (record === undefined) throw new Error("no record");
    writeDocument(store, record.path, {
      data: { ...record.data, "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" },
      body: "",
    });
    expect(openPackage(store, ROOT, DIR, TICKET)).toBeUndefined();
    expect(activePackage(store, ROOT, DIR, TICKET)).toMatchObject({ role: "runner" });
  });

  it("lists the roles of every package of a ticket, whichever is active", () => {
    const store = seeded();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    expect(packageRoles(store, DIR, TICKET)).toStrictEqual(["implementer", "runner"]);
    expect(packageRoles(store, DIR, OTHER)).toStrictEqual([]);
  });

  it("leaves a stamped record valid for a rebuild of the index", async () => {
    const store = seeded();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    const index = await openIndex(store, ROOT, { memory: true });
    rebuildChange(index, LIVE);
    expect(openAttempts(index, CHANGE).map((attempt) => attempt.ticket)).toEqual([TICKET]);
  });
});

describe("manifests", () => {
  function manifest(store: Store, id: string, fields: Record<string, unknown>): void {
    const data = { ...evidence, id, ticket: TICKET, target: "02-3", ...fields };
    writeDocument(store, `${DIR}/evidence/${data.target}-${id}.md`, { data, body: "" });
  }

  function withManifests(): Store {
    const store = seeded();
    manifest(store, "E-00000003", { at: "2026-09-25T10:03:00.000Z" });
    manifest(store, "E-00000001", {
      at: "2026-09-25T10:01:00.000Z",
      target: "02-1",
      ticket: OTHER,
    });
    manifest(store, "E-00000002", { at: "2026-09-25T10:03:00.000Z", target: "02" });
    manifest(store, "E-00000004", {
      at: "2026-09-25T10:00:00.000Z",
      target: "03-1",
      ticket: OTHER,
    });
    manifest(store, "E-00000005", { at: "2026-09-25T10:04:00.000Z", target: CHANGE });
    return store;
  }

  const ids = (files: readonly { data: { id: string } }[]) => files.map((file) => file.data.id);

  it("reads every manifest, oldest first, then by id", () => {
    expect(ids(readManifests(withManifests(), DIR))).toStrictEqual([
      "E-00000004",
      "E-00000001",
      "E-00000002",
      "E-00000003",
      "E-00000005",
    ]);
  });

  it("answers none for a Change without evidence", () => {
    expect(readManifests(seeded(), DIR)).toStrictEqual([]);
  });

  it("selects the manifests of a ticket", () => {
    const all = readManifests(withManifests(), DIR);
    expect(ids(ticketManifests(all, OTHER))).toStrictEqual(["E-00000004", "E-00000001"]);
  });

  it("selects the manifests of a part: the part and its tasks, not the Change", () => {
    const all = readManifests(withManifests(), DIR);
    expect(ids(partManifests(all, "02"))).toStrictEqual(["E-00000001", "E-00000002", "E-00000003"]);
    expect(ids(partManifests(all, "03"))).toStrictEqual(["E-00000004"]);
    expect(partManifests(all, "04")).toStrictEqual([]);
  });

  it("keeps the manifest path and the committed capture out of the list", () => {
    const store = withManifests();
    store.write(`${DIR}/evidence/02-3-E-00000003-junit.xml`, "<testsuites/>\n");
    const [first] = readManifests(store, DIR);
    expect(first?.path).toBe(`${DIR}/evidence/03-1-E-00000004.md`);
    expect(readManifests(store, DIR)).toHaveLength(5);
  });
});
