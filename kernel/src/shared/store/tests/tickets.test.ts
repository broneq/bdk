// The ticket queries of `kernel-state`, Attempt record (`package`; T23-D42)
// and Evidence manifest: the active package, the stamp written by each
// `dispatch build`, and the manifests of a ticket and of a part.
import { describe, expect, it } from "vitest";

import {
  activePackage,
  agentsRegistryPath,
  memoryRegistry,
  memoryStore,
  openAttempts,
  openIndex,
  openPackage,
  packageRoles,
  partManifests,
  readAttempts,
  readManifests,
  rebuildChange,
  resolveTicketRef,
  stampPackage,
  ticketManifests,
  writeDocument,
} from "../index.ts";
import type { ChangeLocation, Heartbeat, RegistryOpener, Store } from "../index.ts";
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

/** `resolveTicketRef` over `store`, with no agent registry unless `openRegistry` is given. */
function resolve(store: Store, value: string, openRegistry: RegistryOpener = memoryRegistry()) {
  return resolveTicketRef({ store, openRegistry }, ROOT, DIR, value);
}

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

describe("resolveTicketRef (`kernel-cli`, Ticket references)", () => {
  const ROUND = "A-r1v2w3x4";

  function withRound(store: Store): Store {
    writeDocument(store, `${DIR}/attempts/review-fix-${CHANGE}-${ROUND}.md`, {
      data: {
        schema: 1,
        ticket: ROUND,
        loop: "review-fix",
        target: CHANGE,
        attempt: 1,
        of: 2,
        scope: "full",
        "opened-at": "2026-09-25T11:00:00.000Z",
        author: "Ada <ada@example.com>",
      },
      body: "",
    });
    for (const group of ["p01", "p02"]) {
      writeDocument(store, `${DIR}/dispatch/${CHANGE}-reviewer-${ROUND}-${group}.md`, {
        data: {
          ...dispatch,
          ticket: ROUND,
          target: CHANGE,
          role: "reviewer",
          group,
          files: [],
          report: `${REL}/reports/${CHANGE}-reviewer-${ROUND}-${group}.md`,
        },
        body: "",
      });
    }
    return store;
  }

  it("resolves a plain ticket to its active package", async () => {
    const store = seeded();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    expect(await resolve(store, TICKET)).toMatchObject({
      ticket: TICKET,
      open: true,
      package: { role: "runner" },
    });
    expect(await resolve(store, TICKET)).not.toHaveProperty("group");
  });

  it("resolves a group reference to the group's package, never the active one", async () => {
    const store = withRound(seeded());
    expect(await resolve(store, `${ROUND}@p02`)).toMatchObject({
      ticket: ROUND,
      group: "p02",
      package: { path: `${REL}/dispatch/${CHANGE}-reviewer-${ROUND}-p02.md` },
    });
    expect(await resolve(store, `${ROUND}@p09`)).not.toHaveProperty("package");
    expect(await resolve(store, ROUND)).not.toHaveProperty("package");
  });

  it("resolves the merge group with no package", async () => {
    const resolved = await resolve(withRound(seeded()), `${ROUND}@merge`);
    expect(resolved).toMatchObject({ ticket: ROUND, group: "merge", open: true });
    expect(resolved).not.toHaveProperty("package");
  });

  it.each([`${ROUND}@P_01`, `${ROUND}@${"g".repeat(33)}`, `${ROUND}@`, `${ROUND}@p01@p02`])(
    "refuses %s with input/invalid-argument",
    async (value) => {
      expect(await resolve(withRound(seeded()), value)).toMatchObject({
        rule: "input/invalid-argument",
      });
    },
  );

  it("refuses a group on a ticket of another loop", async () => {
    expect(await resolve(seeded(), `${TICKET}@p01`)).toMatchObject({
      rule: "input/invalid-argument",
    });
  });

  it("answers a ticket without a record as not open and without a package", async () => {
    const resolved = await resolve(seeded(), OTHER);
    expect(resolved).toMatchObject({ ticket: OTHER, open: false });
    expect(resolved).not.toHaveProperty("record");
  });

  it("leaves group packages out of the ticket's role list", () => {
    expect(packageRoles(withRound(seeded()), DIR, ROUND)).toStrictEqual([]);
  });
});

describe("resolveTicketRef and the agent working on the ticket (#133)", () => {
  const SIMPLIFIER = "a1c3e5a7c9e1a3c5e";
  const RUNNER = "a3b5d7f9b1d3f5b7d";
  const STARTED = "2026-09-25T10:05:00.000Z";

  /** The seeded Change, the runner's package active, and a registry of `agents`. */
  async function working(
    agents: Readonly<Record<string, { readonly role: string; readonly endedAt?: string }>>,
    heartbeats: Readonly<Record<string, Heartbeat>> = {},
  ) {
    const store = seeded();
    writeDocument(store, `${ROOT}/${pkg("simplifier")}`, {
      data: { ...dispatch, ticket: TICKET, role: "simplifier", report: `${REL}/reports/s.md` },
      body: "",
    });
    stampPackage(store, DIR, TICKET, pkg("runner"));
    store.write(agentsRegistryPath(ROOT), "");
    const openRegistry = memoryRegistry((id) => heartbeats[id]);
    const registry = await openRegistry(ROOT);
    for (const [id, { role, endedAt }] of Object.entries(agents)) {
      registry.put(id, {
        ticket: TICKET,
        package: pkg(role),
        startedAt: STARTED,
        ...(endedAt === undefined ? {} : { endedAt, endedBy: "subagent-stop" as const }),
      });
    }
    return () => resolve(store, TICKET, openRegistry);
  }

  it("names the working agent's package over the active stamp", async () => {
    const resolveRef = await working({ [SIMPLIFIER]: { role: "simplifier" } });
    expect(await resolveRef()).toMatchObject({
      package: { role: "simplifier", path: pkg("simplifier") },
    });
  });

  it("keeps the active stamp once the agent ended", async () => {
    const resolveRef = await working({
      [SIMPLIFIER]: { role: "simplifier", endedAt: "2026-09-25T10:06:00.000Z" },
    });
    expect(await resolveRef()).toMatchObject({ package: { role: "runner" } });
  });

  it("counts an ended agent that a heartbeat after its end resumed", async () => {
    const resolveRef = await working(
      { [SIMPLIFIER]: { role: "simplifier", endedAt: "2026-09-25T10:06:00.000Z" } },
      { [SIMPLIFIER]: { open: true, atMs: Date.parse("2026-09-25T10:07:00.000Z") } },
    );
    expect(await resolveRef()).toMatchObject({ package: { role: "simplifier" } });
  });

  it("narrows two working steps to the agent in an open tool call", async () => {
    const resolveRef = await working(
      { [SIMPLIFIER]: { role: "simplifier" }, [RUNNER]: { role: "runner" } },
      {
        [SIMPLIFIER]: { open: true, atMs: Date.parse(STARTED) },
        [RUNNER]: { open: false, atMs: Date.parse(STARTED) },
      },
    );
    expect(await resolveRef()).toMatchObject({ package: { role: "simplifier" } });
  });

  it("leaves out a working agent whose own report is stored", async () => {
    const store = seeded();
    stampPackage(store, DIR, TICKET, pkg("runner"));
    store.write(agentsRegistryPath(ROOT), "");
    writeDocument(store, `${ROOT}/${REL}/reports/02-3-implementer-${TICKET}.md`, {
      data: {
        schema: 1,
        ticket: TICKET,
        role: "implementer",
        at: "2026-09-25T10:06:00.000Z",
        status: "done",
        files: [],
        entries: [],
        evidence: [],
      },
      body: "",
    });
    const openRegistry = memoryRegistry();
    (await openRegistry(ROOT)).put(SIMPLIFIER, {
      ticket: TICKET,
      package: pkg("implementer"),
      startedAt: STARTED,
    });
    expect(await resolve(store, TICKET, openRegistry)).toMatchObject({
      package: { role: "runner" },
    });
  });

  it("keeps the active stamp while two working steps stay ambiguous", async () => {
    const resolveRef = await working({
      [SIMPLIFIER]: { role: "simplifier" },
      [RUNNER]: { role: "implementer" },
    });
    expect(await resolveRef()).toMatchObject({ package: { role: "runner" } });
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
