// `kernel-pipeline`, Gate: provenance and timing only.
import { describe, expect, it } from "vitest";

import { gateStatus } from "../domain/gate.ts";
import type { GateInput } from "../domain/gate.ts";
import type { GraphEntry } from "../domain/kinds/index.ts";

const READY = "2026-09-25T10:00:00Z";

function entry(fields: Partial<GraphEntry> & { id: string }): GraphEntry {
  return {
    type: "transition",
    at: READY,
    source: "user",
    refs: ["gate:design"],
    summary: "fixture",
    status: "accepted",
    review: false,
    gate: "gate:design",
    to: "plan",
    ...fields,
  };
}

function gate(entries: readonly GraphEntry[], extra: Partial<GateInput> = {}) {
  return gateStatus({
    id: "gate:design",
    readyAt: READY,
    incomplete: false,
    satisfied: true,
    policy: "manual",
    command: "/bdk:plan",
    entries,
    ...extra,
  });
}

describe("the gate rule", () => {
  it("a user transition at the ready time passes, in the same second too", () => {
    expect(gate([entry({ id: "L-00000001" })])).toMatchObject({
      ready: true,
      done: true,
      passedBy: "user",
      command: "/bdk:plan",
    });
  });

  it("an older entry does not count", () => {
    const status = gate([entry({ id: "L-00000001", at: "2026-09-25T09:59:59Z" })]);
    expect(status).toMatchObject({ ready: true, done: false });
    expect(status.why).toContain("L-00000001 is older than the ready time");
  });

  it("a policy entry counts only under auto", () => {
    const policy = [entry({ id: "L-00000001", source: "policy" })];
    expect(gate(policy).done).toBe(false);
    expect(gate(policy).why).toContain("has source policy and policy.gates is manual");
    expect(gate(policy, { policy: "auto" })).toMatchObject({ done: true, passedBy: "policy" });
  });

  it("another source or another entry type never counts", () => {
    const status = gate([
      entry({ id: "L-00000001", source: "kernel" }),
      entry({ id: "L-00000002", type: "decision", summary: "Design approved" }),
      entry({ id: "L-00000003", gate: "gate:review" }),
    ]);
    expect(status.done).toBe(false);
    expect(status.why).toContain("L-00000001 has source kernel");
  });

  it("names the missing transition and the command", () => {
    expect(gate([]).why).toBe(
      `ready since ${READY}; no transition names gate:design; the user passes it with /bdk:plan`,
    );
  });

  it("is not ready and not done while a requirement is open", () => {
    const status = gate([entry({ id: "L-00000001" })], { incomplete: true, satisfied: false });
    expect(status).toMatchObject({ ready: false, done: false, why: "a requirement is not done" });
  });

  it("without a ready time any accepted entry counts", () => {
    expect(gate([entry({ id: "L-00000001" })], { readyAt: undefined }).done).toBe(true);
  });

  it("lists live review entries newest first as pending", () => {
    const status = gate([
      entry({ id: "L-00000001", type: "question", review: true, at: "2026-09-25T09:00:00Z" }),
      entry({ id: "L-00000002", type: "finding", review: true, at: "2026-09-25T09:30:00Z" }),
      entry({ id: "L-00000003", type: "finding", review: true, status: "resolved" }),
    ]);
    expect(status.pending.map((item) => item.id)).toStrictEqual(["L-00000002", "L-00000001"]);
  });
});
