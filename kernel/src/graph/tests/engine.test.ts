// `kernel-pipeline`, Node states and Graph variants: the engine on the
// shipped pipeline over literal files and entries.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { evaluate } from "../domain/engine.ts";
import type { Graph, GraphInput } from "../domain/engine.ts";
import { kindRegistry } from "../domain/kinds/index.ts";
import { stageCommand, stageOfTarget } from "../domain/pipeline.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { fakeHash, fakeView } from "./view.ts";
import type { ViewFixture } from "./view.ts";

const pipeline = parse(
  readFileSync(join(import.meta.dirname, "../../../../pipeline/pipeline.yaml"), "utf8"),
) as Pipeline;

function graph(fixture: ViewFixture, options: Partial<GraphInput> = {}, versions = {}): Graph {
  return evaluate({
    pipeline,
    kinds: kindRegistry(),
    view: fakeView(fixture),
    features: { lavish: true },
    gates: { design: "manual", review: "manual" },
    hash: fakeHash(versions),
    ...options,
  });
}

function state(result: Graph, id: string): string | undefined {
  return result.find(id)?.state;
}

let n = 0;
/** A kernel `done` transition for `to` with the fake hash of version 1. */
function done(to: string, hash: string, at = "2026-09-25T10:00:00.000Z") {
  n += 1;
  return { id: `L-d${String(n).padStart(7, "0")}`, type: "transition", to, inputHash: hash, at };
}

function userGate(gate: string, at: string, source = "user") {
  n += 1;
  return {
    id: `L-u${String(n).padStart(7, "0")}`,
    type: "transition",
    to: "plan",
    gate,
    source,
    at,
  };
}

const small = {
  files: { "change.md": {}, "design.md": {}, "architecture.md": {} },
};

describe("node states", () => {
  it("a new small Change: intent done, design ready, the rest blocked", () => {
    const result = graph({ files: { "change.md": {} } });
    expect(state(result, "intent")).toBe("done");
    expect(state(result, "design")).toBe("ready");
    expect(state(result, "architecture")).toBe("blocked");
    expect(result.find("architecture")?.why).toBe("design is ready, not done");
    expect(result.next?.id).toBe("design");
  });

  it("done when the recorded hash equals the current one, stale otherwise", () => {
    const entries = [done("design", "design.md@1")];
    expect(state(graph({ ...small, entries }), "design")).toBe("done");
    const stale = graph({ ...small, entries }, {}, { "design.md": "2" });
    expect(stale.find("design")).toMatchObject({
      state: "stale",
      inputHash: "design.md@2",
      why: "inputs changed: recorded design.md@1, current design.md@2",
    });
    expect(stale.next?.id).toBe("design");
  });

  it("only kernel transitions record done", () => {
    const entries = [{ ...done("design", "design.md@1"), source: "user" }];
    expect(state(graph({ ...small, entries }), "design")).toBe("ready");
  });

  it("the latest done entry counts", () => {
    const entries = [
      done("design", "design.md@2", "2026-09-25T10:00:00.000Z"),
      done("design", "design.md@1", "2026-09-25T11:00:00.000Z"),
    ];
    expect(state(graph({ ...small, entries }), "design")).toBe("done");
  });

  it("a requirement on a skipped node is satisfied", () => {
    const productOnly = graph({
      files: { "change.md": {}, "design.md": { data: { architecture: false } } },
      entries: [done("design", "design.md@1")],
    });
    expect(productOnly.find("architecture")).toMatchObject({
      state: "skipped",
      why: "design.md declares architecture: false (product-only Change)",
    });
    expect(productOnly.find("gate:design")?.requires).toStrictEqual(["design", "design-verify"]);
    expect(state(productOnly, "gate:design")).toBe("blocked");
    expect(productOnly.next?.id).toBe("design-verify");
  });

  it("a collection without instances is the actionable node", () => {
    const result = graph({
      ...small,
      entries: [
        done("design", "design.md@1"),
        done("architecture", "architecture.md@1"),
        done("design-verify", "design.md@1,architecture.md@1"),
        userGate("gate:design", "2026-09-25T11:00:00.000Z"),
      ],
    });
    expect(result.next?.id).toBe("plan");
    expect(state(result, "plan-verify")).toBe("blocked");
    expect(result.find("plan-verify")?.why).toBe("plan is ready, not done");
  });

  it("a collection is done only when every instance is", () => {
    const files = {
      ...small.files,
      "plan/parts/01-a.md": { data: { "depends-on": [] } },
      "plan/parts/02-b.md": { data: { "depends-on": ["01"] } },
    };
    const passed = [
      done("design", "design.md@1"),
      done("architecture", "architecture.md@1"),
      done("design-verify", "design.md@1,architecture.md@1"),
      userGate("gate:design", "2026-09-25T11:00:00.000Z"),
    ];
    const one = graph({
      files,
      entries: [...passed, done("plan-part:01", "plan/parts/01-a.md@1")],
    });
    expect(one.find("plan")).toMatchObject({
      state: "ready",
      instances: ["plan-part:01", "plan-part:02"],
    });
    expect(one.find("plan-verify")).toMatchObject({
      state: "blocked",
      requires: ["plan-part:01", "plan-part:02", "design", "architecture"],
      why: "plan-part:02 is ready, not done",
    });
    expect(one.next?.id).toBe("plan-part:02");
    const both = graph({
      files,
      entries: [
        ...passed,
        done("plan-part:01", "plan/parts/01-a.md@1"),
        done("plan-part:02", "plan/parts/02-b.md@1"),
      ],
    });
    expect(state(both, "plan")).toBe("done");
    expect(both.next?.id).toBe("plan-verify");
    expect(both.find("execute-part:02")?.requires).toStrictEqual([
      "plan-part:01",
      "plan-part:02",
      "plan-verify",
      "execute-part:01",
    ]);
    expect(both.find("execute-part:02")?.state).toBe("blocked");
  });

  it("a collection with instances but unmet requirements is blocked", () => {
    const result = graph({ files: { ...small.files, "plan/parts/01-a.md": {} } });
    expect(result.find("plan")).toMatchObject({
      state: "blocked",
      why: "gate:design is blocked, not done",
    });
  });

  it("a kind with no inputs is done by any kernel transition", () => {
    const result = graph({ entries: [done("close", "x")] });
    expect(state(result, "close")).toBe("done");
  });

  it("throws on a node of an unknown kind", () => {
    expect(() => graph({}, { kinds: new Map() })).toThrow("unknown kind intent");
  });
});

describe("sealing", () => {
  const passedAt = "2026-09-25T11:00:00.000Z";
  const entries = [
    done("design", "design.md@1"),
    done("architecture", "architecture.md@1"),
    done("design-verify", "design.md@1,architecture.md@1"),
    userGate("gate:design", passedAt),
  ];

  it("a stale node behind a done gate is not returned and does not reopen it", () => {
    const result = graph({ ...small, entries }, {}, { "design.md": "2" });
    expect(result.find("design")).toMatchObject({ state: "stale", sealed: true });
    expect(state(result, "gate:design")).toBe("done");
    expect(result.next?.id).toBe("plan");
  });

  it("a loop-back moves the ready time past the old entry", () => {
    const loop = [...entries, done("design", "design.md@2", "2026-09-25T12:00:00.000Z")];
    const unverified = graph({ ...small, entries: loop }, {}, { "design.md": "2" });
    expect(unverified.find("gate:design")?.gate).toMatchObject({ ready: false, done: false });
    expect(unverified.next?.id).toBe("design-verify");
    const verified = [
      ...loop,
      done("design-verify", "design.md@2,architecture.md@1", "2026-09-25T12:30:00.000Z"),
    ];
    const result = graph({ ...small, entries: verified }, {}, { "design.md": "2" });
    expect(result.find("gate:design")?.gate).toMatchObject({
      ready: true,
      done: false,
      readyAt: "2026-09-25T12:30:00.000Z",
    });
    expect(result.waitingGate?.gate).toBe("gate:design");
    expect(result.next).toBeUndefined();
  });
});

describe("next", () => {
  it("returns design-verify before the design gate", () => {
    const result = graph({
      ...small,
      entries: [done("design", "design.md@1"), done("architecture", "architecture.md@1")],
    });
    expect(result.next?.id).toBe("design-verify");
    expect(result.find("gate:design")).toMatchObject({
      state: "blocked",
      requires: ["design", "architecture", "design-verify"],
    });
  });

  it("makes design-verify stale when the design changes after the verdict", () => {
    const entries = [
      done("design", "design.md@1"),
      done("architecture", "architecture.md@1"),
      done("design-verify", "design.md@1,architecture.md@1"),
    ];
    const result = graph({ ...small, entries }, {}, { "design.md": "2" });
    expect(state(result, "design-verify")).toBe("stale");
    expect(state(result, "gate:design")).toBe("blocked");
  });

  it("walks pipeline order and waits at a ready gate", () => {
    const result = graph({
      ...small,
      entries: [
        done("design", "design.md@1"),
        done("architecture", "architecture.md@1"),
        done("design-verify", "design.md@1,architecture.md@1"),
      ],
    });
    expect(result.next).toBeUndefined();
    expect(result.waitingGate).toMatchObject({ gate: "gate:design", command: "/bdk:plan" });
  });

  it("has neither next nor a waiting gate when everything is done", () => {
    const result = graph({
      profile: "tiny",
      files: { "change.md": {}, "plan/parts/01-a.md": { data: { "depends-on": [] } } },
      entries: [
        done("plan-part:01", "plan/parts/01-a.md@1"),
        done("execute-part:01", "plan/parts/01-a.md@1"),
        done("review", "tree@1"),
        userGate("gate:review", "2026-09-25T11:00:00.000Z"),
        done("close", "x", "2026-09-25T12:00:00.000Z"),
      ],
      evidence: [
        ...["conform", "tests-scoped", "lint"].map((kind, at) => ({
          id: `E-0000000${String(at)}`,
          kind,
          target: "01",
          verdict: "pass",
          cited: true,
        })),
        ...["tests-full", "lint-full"].map((kind, at) => ({
          id: `E-1000000${String(at)}`,
          kind,
          target: "2026-09-25-login",
          verdict: "pass",
          cited: true,
        })),
      ],
    });
    expect(
      result.nodes.filter((node) => node.state !== "done" && node.state !== "skipped"),
    ).toStrictEqual([]);
    expect(result.next).toBeUndefined();
    expect(result.waitingGate).toBeUndefined();
  });
});

describe("done markers", () => {
  const files = {
    "change.md": {},
    "plan/parts/01-a.md": { data: { "depends-on": [] } },
  };
  const planned = done("plan-part:01", "plan/parts/01-a.md@1");

  it("a kernel transition without input-hash leaves the node ready", () => {
    n += 1;
    const start = {
      id: `L-s${String(n).padStart(7, "0")}`,
      type: "transition",
      to: "execute-part:01",
      at: "2026-09-25T11:00:00.000Z",
    };
    const result = graph({ profile: "tiny", files, entries: [planned, start] });
    expect(state(result, "execute-part:01")).toBe("ready");
    expect(result.find("execute-part:01")?.recorded).toBeUndefined();
  });

  it("a later start marker does not hide the done marker before it", () => {
    n += 1;
    const start = {
      id: `L-s${String(n).padStart(7, "0")}`,
      type: "transition",
      to: "execute-part:01",
      at: "2026-09-25T12:00:00.000Z",
    };
    const result = graph({
      profile: "tiny",
      files,
      entries: [planned, done("execute-part:01", "plan/parts/01-a.md@1"), start],
    });
    expect(state(result, "execute-part:01")).toBe("done");
  });

  it("execute-part is stale when its plan part changed after part done", () => {
    const result = graph(
      {
        profile: "tiny",
        files,
        entries: [
          done("plan-part:01", "plan/parts/01-a.md@2"),
          done("execute-part:01", "plan/parts/01-a.md@1"),
        ],
      },
      {},
      { "plan/parts/01-a.md": "2" },
    );
    expect(state(result, "execute-part:01")).toBe("stale");
  });
});

describe("graph variants", () => {
  const present = (result: Graph) =>
    result.nodes.filter((node) => node.state !== "skipped").map((node) => node.id);

  it("tiny: no design, architecture, design gate or plan-verify; next is plan", () => {
    const result = graph({ profile: "tiny" });
    expect(present(result)).toStrictEqual([
      "intent",
      "plan",
      "execute",
      "conform",
      "tests-scoped",
      "lint",
      "tests-full",
      "lint-full",
      "review",
      "gate:review",
      "close",
    ]);
    expect(result.find("design")?.why).toBe("profile tiny is not in profiles [small]");
    expect(result.next?.id).toBe("plan");
  });

  it("small: design, architecture, design-verify and the design gate", () => {
    expect(present(graph(small))).toStrictEqual([
      "intent",
      "design",
      "architecture",
      "design-verify",
      "gate:design",
      "plan",
      "plan-verify",
      "execute",
      "conform",
      "tests-scoped",
      "lint",
      "tests-full",
      "lint-full",
      "review",
      "gate:review",
      "close",
    ]);
  });

  it("large: design parts and index, then architecture before any plan node", () => {
    const files = { "change.md": {}, "design/parts/01-a.md": {}, "design/parts/02-b.md": {} };
    const result = graph({
      profile: "large",
      files,
      entries: [
        done("design-part:01", "design/parts/01-a.md@1"),
        done("design-part:02", "design/parts/02-b.md@1"),
        done("design-index", "design/parts/01-a.md@1,design/parts/02-b.md@1"),
      ],
    });
    expect(present(result)).toContain("design-part:01");
    expect(present(result)).toContain("design-part:02");
    expect(present(result)).not.toContain("design");
    expect(result.next?.id).toBe("architecture");
    expect(result.find("design-verify")?.requires).toStrictEqual(["design-index", "architecture"]);
  });

  it("bug: from intent to plan", () => {
    const result = graph({ kind: "bug" });
    expect(result.find("design")?.why).toBe("Change kind bug is not in kinds [feature]");
    expect(result.next).toMatchObject({ id: "plan", kind: "plan-part" });
    expect(present(result)).toContain("plan-verify");
    expect(present(result)).not.toContain("design-verify");
    const planned = graph({
      kind: "bug",
      files: { "change.md": {}, "plan/parts/01-a.md": { data: { "depends-on": [] } } },
      entries: [done("plan-part:01", "plan/parts/01-a.md@1")],
    });
    expect(planned.find("plan-verify")?.requires).toStrictEqual(["plan-part:01"]);
    expect(planned.next?.id).toBe("plan-verify");
  });

  it("review: intent, the full gate, review, its gate and close; next is the gate runner", () => {
    const result = graph({ kind: "review" });
    expect(present(result)).toStrictEqual([
      "intent",
      "tests-full",
      "lint-full",
      "review",
      "gate:review",
      "close",
    ]);
    expect(result.find("plan")?.why).toBe("Change kind review is not in kinds [feature, bug]");
    expect(result.find("review")?.requires).toStrictEqual(["tests-full", "lint-full"]);
    expect(result.next).toMatchObject({ id: "tests-full", stage: "review" });
  });

  it("spec-delta only when a plan part has spec-impact", () => {
    expect(state(graph({}), "spec-delta")).toBe("skipped");
    const withImpact = graph({
      files: { "plan/parts/01-a.md": { data: { "spec-impact": ["auth"] } } },
    });
    expect(state(withImpact, "spec-delta")).toBe("blocked");
  });

  it("a node behind an if exists only while the feature is true", () => {
    const gated: Pipeline = {
      ...pipeline,
      nodes: pipeline.nodes.map((node) =>
        node.id === "design" ? { ...node, if: "features.lavish" } : node,
      ),
    };
    expect(graph(small, { pipeline: gated, features: { lavish: false } }).find("design")?.why).toBe(
      "features.lavish is false",
    );
    expect(state(graph(small, { pipeline: gated }), "design")).toBe("ready");
  });
});

describe("stageOfTarget and stageCommand", () => {
  it.each([
    ["plan-part:02", "plan"],
    ["design-part:01", "design"],
    ["design", "design"],
    ["gate:design", "design"],
    ["execute", "execute"],
    ["review", "review"],
    ["closed", "closed"],
  ])("%s -> %s", (to, stage) => {
    expect(stageOfTarget(pipeline, to)).toBe(stage);
  });

  it("answers the command of a stage", () => {
    expect(stageCommand(pipeline, "plan")).toBe("/bdk:plan");
    expect(stageCommand(pipeline, "closed")).toBeUndefined();
  });
});
