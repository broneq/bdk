// `bdk rebuild` through the real registry over a started Change in memory
// with a scripted git (`kernel-cli/service`, bdk rebuild; T22 design D-12).
// A migration needs a registered one; the core test covers it with a test kind.
import { describe, expect, it } from "vitest";

import { attemptRegistrations } from "../../attempt/index.ts";
import { setChange, writePlanPart } from "../../graph/tests/support.ts";
import { ROOT } from "../../log/tests/support.ts";
import { harness as partHarness, openTicket, tasks, DIR } from "../../part/tests/support.ts";
import type { Harness } from "../../part/tests/support.ts";
import type { PartDeps } from "../../part/index.ts";
import { serviceRegistrations } from "../index.ts";
import { rebuildOutput } from "../schema/rebuild.ts";

const OTHER = `${ROOT}/.bdk/changes/2026-09-20-dark-mode`;

async function started(): Promise<Harness> {
  const h = partHarness((deps: PartDeps) => [
    ...serviceRegistrations({ ...deps, contract: 3 }),
    ...attemptRegistrations(deps),
  ]);
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: tasks("01", 2) });
  expect((await h.run(["done", "plan"])).code).toBe(0);
  expect((await h.run(["part", "start", "01"])).code).toBe(0);
  return h;
}

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string };
}

describe("rebuild", () => {
  it("rebuilds the active Change: counts, the regenerated plan index", async () => {
    const h = await started();
    openTicket(h.store, "A-00000001", "01-1");
    h.git.commits = [["c1".repeat(20), "01", "01-1"]];
    const index = h.store.read(`${DIR}/plan/index.md`);
    h.store.write(`${DIR}/plan/index.md`, "stale\n");
    const result = await h.run(["rebuild", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    const report = rebuildOutput.parse(result.json);
    expect(report).toMatchObject({
      changes: 1,
      entries: h.store.list(`${DIR}/log`).length,
      attempts: 1,
      commits: 1,
      migrated: [],
      warnings: [],
    });
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(h.store.read(`${DIR}/plan/index.md`)).toBe(index);
    expect((await h.run(["rebuild"])).stdout).toMatch(
      /^rebuilt 1 Change: \d+ entries, 1 attempt, 1 commit in \d+ ms\n$/,
    );
  });

  it("--all rebuilds every Change and still needs the active one", async () => {
    const h = await started();
    h.store.write(
      `${OTHER}/change.md`,
      (h.store.read(`${DIR}/change.md`) ?? "").replace("2026-09-25-login", "2026-09-20-dark-mode"),
    );
    expect(rebuildOutput.parse((await h.run(["rebuild", "--all", "--json"])).json).changes).toBe(2);
    h.git.branch = "feat/unbound";
    const unbound = await h.run(["rebuild", "--json"]);
    expect(unbound.code).toBe(2);
    expect(refusal(unbound).rule).toBe("policy/no-active-change");
    expect(refusal(await h.run(["rebuild", "--all", "--json"])).rule).toBe(
      "policy/no-active-change",
    );
  });

  it("lists a document newer than the kernel in warnings and leaves it", async () => {
    const h = await started();
    const path = `${DIR}/log/20260925T120000Z-finding-L-future00.md`;
    const text =
      "---\nschema: 2\nid: L-future00\ntype: finding\nsummary: s\nstatus: proposed\nsource: kernel\nauthor: A <a@b.c>\nat: 2026-09-25T12:00:00Z\nrefs: [a.ts]\n---\n";
    h.store.write(path, text);
    const report = rebuildOutput.parse((await h.run(["rebuild", "--json"])).json);
    expect(report.warnings).toStrictEqual([expect.stringContaining("L-future00") as string]);
    expect(h.store.read(path)).toBe(text);
  });

  it("refuses state/trailer-mismatch naming both sides, the index still regenerated", async () => {
    const h = await started();
    h.git.commits = [["c1".repeat(20), "02", "01-1"]];
    const index = h.store.read(`${DIR}/plan/index.md`);
    h.store.write(`${DIR}/plan/index.md`, "stale\n");
    const result = await h.run(["rebuild", "--json"]);
    expect(result.code).toBe(4);
    expect(refusal(result).rule).toBe("state/trailer-mismatch");
    expect(refusal(result).why).toContain("01-1");
    expect(refusal(result).why).toContain("02");
    expect(h.store.read(`${DIR}/plan/index.md`)).toBe(index);
  });
});
