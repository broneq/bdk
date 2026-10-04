// The review stage of T42 (`kernel-pipeline`, Artifact kinds and Graph
// variants; D2, D4, D6): the change-level checks `tests-full` and `lint-full`,
// done from fresh evidence of the Change, `tests-full` also from the coverage
// of every test entry with a threshold; and the `review` verdict from the
// merged report of a `review-fix` round, every entry of the round triaged and
// no live entry triaged `blocker`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { evaluate } from "../domain/engine.ts";
import type { Graph } from "../domain/engine.ts";
import { ChangeCheckKind, kindRegistry } from "../domain/kinds/index.ts";
import type { Check, Kind } from "../domain/kinds/index.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { isBlocking } from "../../shared/vocabulary/index.ts";
import { fakeHash, fakeView } from "./view.ts";
import type { ViewFixture } from "./view.ts";

const CHANGE = "2026-09-25-login";
const ROUND = "A-r1v2w3x4";
const shipped = parse(
  readFileSync(join(import.meta.dirname, "../../../../pipeline/pipeline.yaml"), "utf8"),
) as Pipeline;
const kinds = kindRegistry();

function kind(name: string): Kind {
  const found = kinds.get(name);
  if (found === undefined) throw new Error(`no kind ${name}`);
  return found;
}

const PART = {
  "change.md": {},
  "plan/parts/01-auth.md": { data: { id: "01", "depends-on": [], "spec-impact": "none" } },
};

/** A tiny Change whose plan, execute part and post-task steps are done. */
const EXECUTED = [
  {
    id: "L-d0000001",
    type: "transition",
    to: "plan-part:01",
    inputHash: "plan/parts/01-auth.md@1",
  },
  {
    id: "L-d0000002",
    type: "transition",
    to: "execute-part:01",
    inputHash: "plan/parts/01-auth.md@1",
  },
];
const STEPS = ["simplify", "tests-scoped", "lint"].map((name, at) => ({
  id: `E-s000000${String(at)}`,
  kind: name,
  target: "01",
  verdict: "pass",
  cited: true,
}));

function manifest(id: string, name: string, fields: object = {}) {
  return { id, kind: name, target: CHANGE, verdict: "pass", cited: true, ...fields };
}

function graph(fixture: ViewFixture = {}, profile: "tiny" | "small" | "large" = "tiny"): Graph {
  return evaluate({
    pipeline: shipped,
    kinds,
    view: fakeView({
      profile,
      files: PART,
      entries: EXECUTED,
      ...fixture,
      evidence: [...STEPS, ...(fixture.evidence ?? [])],
    }),
    features: {},
    gates: { design: "manual", review: "manual" },
    hash: fakeHash(),
  });
}

function check(checks: readonly Check[], id: string): Check | undefined {
  return checks.find((item) => item.id === id);
}

describe("the change-level check kinds", () => {
  it("registers eighteen kinds, tests-full and lint-full on one base", () => {
    expect(kinds.size).toBe(18);
    for (const name of ["tests-full", "lint-full"]) {
      expect(kinds.get(name)).toBeInstanceOf(ChangeCheckKind);
    }
    expect(kinds.has("change-check")).toBe(false);
  });

  it.each([
    ["tiny", "feature"],
    ["small", "feature"],
    ["large", "feature"],
    ["small", "bug"],
  ] as const)(
    "puts both nodes before review in a %s %s Change, required by it",
    (profile, type) => {
      const result = graph({ kind: type }, profile);
      const ids = result.nodes.map((node) => node.id);
      expect(ids.indexOf("spec-delta")).toBeLessThan(ids.indexOf("tests-full"));
      expect(ids.indexOf("tests-full")).toBeLessThan(ids.indexOf("lint-full"));
      expect(ids.indexOf("lint-full")).toBeLessThan(ids.indexOf("review"));
      expect(result.find("review")?.requires).toEqual(
        expect.arrayContaining(["tests-full", "lint-full"]),
      );
    },
  );

  it("is ready without evidence once the steps are done, and blocks review", () => {
    const result = graph();
    expect(result.find("tests-full")?.state).toBe("ready");
    expect(result.find("review")).toMatchObject({
      state: "blocked",
      why: "tests-full is ready, not done",
    });
  });

  it("is done from a fresh pass of the Change, not from a part's manifest", () => {
    const result = graph({
      evidence: [
        manifest("E-f0000001", "tests-full"),
        { ...manifest("E-l0000001", "lint-full"), target: "01" },
      ],
    });
    expect(result.find("tests-full")?.state).toBe("done");
    expect(result.find("lint-full")?.state).toBe("ready");
  });

  it("leaves a fail not done, naming the manifest", () => {
    const result = graph({ evidence: [manifest("E-l0000001", "lint-full", { verdict: "fail" })] });
    expect(result.find("lint-full")).toMatchObject({
      state: "ready",
      why: `evidence E-l0000001 of ${CHANGE} says fail`,
    });
  });

  it("is stale when the Change tree changed since the manifest", () => {
    const result = graph({
      evidence: [
        manifest("E-f0000001", "tests-full", { fresh: false }),
        manifest("E-l0000001", "lint-full", { fresh: false }),
      ],
    });
    expect(result.find("tests-full")?.state).toBe("stale");
    expect(result.find("lint-full")?.state).toBe("stale");
  });

  it("keeps tests-full open while the coverage of an entry with min fails, naming it", () => {
    const result = graph({
      coverageTools: ["unit"],
      evidence: [
        manifest("E-f0000001", "tests-full"),
        manifest("E-c0000001", "coverage", { tool: "unit", verdict: "fail" }),
      ],
    });
    expect(result.find("tests-full")).toMatchObject({
      state: "ready",
      why: `coverage E-c0000001 of unit says fail`,
    });
  });

  it("keeps tests-full open without a coverage manifest of an entry with min", () => {
    const result = graph({
      coverageTools: ["unit"],
      evidence: [
        manifest("E-f0000001", "tests-full"),
        manifest("E-c0000001", "coverage", { tool: "e2e" }),
      ],
    });
    expect(result.find("tests-full")).toMatchObject({
      state: "ready",
      why: "no coverage manifest of unit for the Change",
    });
  });

  it("is done with a fresh passing coverage manifest of every entry with min", () => {
    const result = graph({
      coverageTools: ["unit"],
      evidence: [
        manifest("E-c0000001", "coverage", { tool: "unit", verdict: "fail" }),
        manifest("E-f0000001", "tests-full"),
        manifest("E-c0000002", "coverage", { tool: "unit" }),
      ],
    });
    expect(result.find("tests-full")?.state).toBe("done");
  });

  it("is stale when the coverage manifest is stale", () => {
    const result = graph({
      coverageTools: ["unit"],
      evidence: [
        manifest("E-f0000001", "tests-full"),
        manifest("E-c0000001", "coverage", { tool: "unit", fresh: false }),
      ],
    });
    expect(result.find("tests-full")?.state).toBe("stale");
  });

  it("validates with the checks naming each manifest", () => {
    const view = fakeView({
      coverageTools: ["unit"],
      evidence: [manifest("E-f0000001", "tests-full")],
    });
    expect(kind("tests-full").validate(view, { id: "tests-full" })).toStrictEqual([
      { id: "evidence", ok: true, why: `E-f0000001 of ${CHANGE}` },
      { id: "fresh", ok: true },
      { id: "verdict", ok: true, why: "pass" },
      {
        id: "coverage:unit",
        ok: false,
        why: "no coverage manifest of unit for the Change",
        instead: "bdk evidence coverage unit <report> --ticket <ticket>",
      },
    ]);
  });

  it("is done only through evidence; bdk done names bdk evidence record", () => {
    expect(kind("lint-full").doneBy).toStrictEqual({
      through: "evidence",
      command: "bdk evidence record lint-full <file> --ticket <ticket>@<group>",
    });
    expect(kind("tests-full").doneBy).toMatchObject({ through: "evidence" });
  });

  it("hashes the tree of the Change", () => {
    expect(kind("tests-full").inputs(fakeView({ changeTree: "sha256:c" }))).toStrictEqual({
      tree: "sha256:c",
    });
  });
});

describe("the review verdict", () => {
  const merged = (fields: object = {}) => ({
    id: "L-m0000001",
    type: "report",
    refs: [CHANGE, "review"],
    ticket: ROUND,
    group: "merge",
    at: "2026-09-25T12:00:00.000Z",
    ...fields,
  });
  const verdict = (fixture: ViewFixture) =>
    kind("review").validate(
      fakeView({
        loops: { [ROUND]: "review-fix" },
        reports: { "L-m0000001": "done", "L-p0000001": "done" },
        ...fixture,
      }),
      { id: "review" },
    );

  it("refuses a group report on merge-report", () => {
    const checks = verdict({
      entries: [merged({ id: "L-p0000001", group: "p01" })],
    });
    expect(check(checks, "merge-report")).toMatchObject({ ok: false });
    expect(check(checks, "merge-report")?.why).toContain("L-p0000001");
  });

  it("refuses a merge report of a ticket outside review-fix", () => {
    const checks = verdict({ entries: [merged()], loops: { [ROUND]: "verifier" } });
    expect(check(checks, "merge-report")).toMatchObject({ ok: false });
  });

  it("refuses a round that is still open or closed other than ok on round-ok", () => {
    const open = verdict({ entries: [merged()], outcomes: { [ROUND]: undefined } });
    expect(check(open, "round-ok")).toMatchObject({ ok: false });
    expect(check(open, "round-ok")?.why).toContain("is still open");
    const notRun = verdict({ entries: [merged()], outcomes: { [ROUND]: "not-run" } });
    expect(check(notRun, "round-ok")?.why).toContain("closed not-run");
    expect(check(verdict({ entries: [merged()] }), "round-ok")).toMatchObject({ ok: true });
  });

  it("refuses a live untriaged entry of the round on triaged, naming it", () => {
    const checks = verdict({
      entries: [
        { id: "L-f0000001", type: "finding", ticket: ROUND, group: "p01", level: "should-fix" },
        { id: "L-f0000002", type: "finding", ticket: ROUND, group: "p02", status: "proposed" },
        { id: "L-o0000001", type: "observation", ticket: ROUND, status: "resolved" },
        { id: "L-f0000003", type: "finding", ticket: "A-00000000", status: "proposed" },
        merged(),
      ],
    });
    expect(check(checks, "triaged")).toMatchObject({ ok: false });
    expect(check(checks, "triaged")?.why).toContain("L-f0000002");
    expect(check(checks, "triaged")?.why).not.toContain("L-f0000003");
  });

  it("refuses a live entry triaged blocker from any ticket, and passes once it is resolved", () => {
    const blocker = (status: string) => ({
      id: "L-f0000009",
      type: "finding",
      ticket: "A-7f3k9m2q",
      level: "blocker",
      status,
    });
    const open = verdict({ entries: [blocker("proposed"), merged()] });
    expect(check(open, "blockers")).toMatchObject({ ok: false });
    expect(check(open, "blockers")?.why).toContain("L-f0000009");
    const resolved = verdict({ entries: [blocker("resolved"), merged()] });
    expect(resolved.every((item) => item.ok)).toBe(true);
  });

  it("counts exactly the entries the shared blocking predicate names (T42-D3)", () => {
    const entries = [
      { id: "L-f0000001", type: "finding", refs: ["src/a.ts"], level: "blocker" },
      { id: "L-f0000002", type: "finding", refs: ["src/b.ts"], level: "should-fix" },
      { id: "L-b0000001", type: "blocker", refs: ["src/c.ts", "review"], level: "nice-to-have" },
      { id: "L-b0000002", type: "blocker", refs: ["src/d.ts", CHANGE] },
      { id: "L-b0000003", type: "blocker", refs: ["review"], status: "resolved" },
      {
        id: "L-f0000003",
        type: "finding",
        refs: ["src/e.ts"],
        level: "blocker",
        status: "resolved",
      },
    ];
    const named = entries
      .filter((entry) => isBlocking({ status: "proposed", ...entry }, "review", { triaged: true }))
      .map((entry) => entry.id);
    expect(named).toStrictEqual(["L-f0000001", "L-b0000001"]);
    const why = check(verdict({ entries: [...entries, merged()] }), "blockers")?.why ?? "";
    expect(why.match(/L-[a-z0-9]{8}/g)).toStrictEqual(named);
  });

  it("passes on a merged report with every entry of the round triaged", () => {
    const checks = verdict({
      entries: [
        { id: "L-f0000001", type: "finding", ticket: ROUND, group: "p01", level: "nice-to-have" },
        merged(),
      ],
    });
    expect(checks.map((item) => [item.id, item.ok])).toStrictEqual([
      ["verdict", true],
      ["merge-report", true],
      ["round-ok", true],
      ["triaged", true],
      ["blockers", true],
      ["fresh", true],
      ["evidence", true],
    ]);
  });
});
