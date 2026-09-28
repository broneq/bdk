// The change commands T22 adds or completes, on a started Change in memory
// with a scripted git (`kernel-cli/change`: checkpoint, park, takeover and the
// status `parts`; `kernel-loops`, Checkpoint). The in-progress refusal needs a
// real `.git` directory and is covered in `change.e2e.ts`.
import { describe, expect, it } from "vitest";

import { cycle, DIR, open, started } from "../../attempt/tests/support.ts";
import { writePlanPart } from "../../graph/tests/support.ts";
import { openTicket, tasks } from "../../part/tests/support.ts";
import { readAttempts, readDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import {
  changeCheckpointOutput,
  changeParkOutput,
  changeStatusOutput,
  changeTakeoverOutput,
} from "../schema/outputs.ts";

const CHANGE = "2026-09-25-login";
const CHANGE_DIR = `.bdk/changes/${CHANGE}/`;

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string; instead: string[] };
}

function transitions(store: Store) {
  return store
    .list(`${DIR}/log`)
    .filter((name) => name.includes("-transition-"))
    .map((name) => readDocument(store, `${DIR}/log/${name}`))
    .map((document) => (document !== undefined && "data" in document ? document.data : {}));
}

describe("change checkpoint", () => {
  it("commits the Change directory alone with the checkpoint subject", async () => {
    const h = await started();
    h.git.status = ["M  src/app.ts", `${CHANGE_DIR}log/e.md`];
    const result = await h.run(["change", "checkpoint", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(changeCheckpointOutput.parse(result.json)).toStrictEqual({
      change: CHANGE,
      done: true,
      commit: "d8e4f21",
    });
    const argv = h.git.committed.at(-1) ?? [];
    expect(argv).toContain(`chore(bdk): checkpoint ${CHANGE}`);
    expect(argv.slice(argv.indexOf("--") + 1)).toStrictEqual([CHANGE_DIR]);
    expect((await h.run(["change", "checkpoint"])).stdout).toBe(
      `checkpoint of ${CHANGE}: d8e4f21\n`,
    );
  });

  it("skips with exit 0 when nothing under the Change directory changed", async () => {
    const h = await started();
    h.git.status = ["src/app.ts"];
    const result = await h.run(["change", "checkpoint", "--json"]);
    expect(result.code).toBe(0);
    expect(changeCheckpointOutput.parse(result.json)).toStrictEqual({
      change: CHANGE,
      done: false,
      skipped: `nothing under ${CHANGE_DIR} changed since the last commit`,
    });
    expect(h.git.committed).toStrictEqual([]);
  });

  it("skips with exit 0 when policy.checkpoint.enabled is false", async () => {
    const h = await started("policy:\n  checkpoint:\n    enabled: false\n");
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    const result = await h.run(["change", "checkpoint", "--json"]);
    expect(result.json).toStrictEqual({
      change: CHANGE,
      done: false,
      skipped: "policy.checkpoint.enabled is false",
    });
    expect((await h.run(["change", "checkpoint"])).stdout).toBe(
      `checkpoint of ${CHANGE} skipped: policy.checkpoint.enabled is false\n`,
    );
  });

  it("refuses policy/ticket-open while a ticket is open", async () => {
    const h = await started();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    openTicket(h.store, "A-00000001", "01-1");
    const result = await h.run(["change", "checkpoint", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/ticket-open");
    expect(h.git.committed).toStrictEqual([]);
  });

  it("refuses policy/git-hook-failed with the hook's line", async () => {
    const h = await started();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    h.git.commitResult = { code: 1, stdout: "", stderr: "subject too long\n" };
    const result = await h.run(["change", "checkpoint", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/git-hook-failed" });
    expect(refusal(result).why).toContain("subject too long");
  });
});

describe("change park", () => {
  it("reports the checkpoint it ran", async () => {
    const h = await started();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    const result = await h.run(["change", "park", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(changeParkOutput.parse(result.json).checkpoint).toStrictEqual({
      done: true,
      commit: "d8e4f21",
    });
    expect(h.git.committed.at(-1)).toContain(`chore(bdk): checkpoint ${CHANGE}`);
  });

  it("reports a skipped checkpoint and still parks", async () => {
    const h = await started();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    h.git.commitResult = { code: 1, stdout: "", stderr: "hook says no\n" };
    const result = await h.run(["change", "park", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(changeParkOutput.parse(result.json).checkpoint).toStrictEqual({
      done: false,
      skipped: "a git hook rejected the checkpoint commit: hook says no",
    });
    expect((await h.run(["change", "status", "--json"])).json).toHaveProperty("parked");
  });
});

describe("change takeover", () => {
  it("refuses policy/invalid-transition without an open ticket, naming bdk rebuild", async () => {
    const h = await started();
    const result = await h.run(["change", "takeover", "--close-tickets", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/invalid-transition" });
    expect(refusal(result).instead).toContain("bdk rebuild");
  });

  it("refuses policy/ticket-open listing the tickets without --close-tickets", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    const result = await h.run(["change", "takeover", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/ticket-open" });
    expect(refusal(result).why).toContain(ticket);
  });

  it("closes open tickets as not-run, records the transition, rebuilds and keeps budgets", async () => {
    const h = await started();
    await cycle(h, "task-redispatch", "01-1", "fail");
    const { ticket } = await open(h, "task-redispatch", "01-1");
    const result = await h.step(["change", "takeover", "--close-tickets", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(changeTakeoverOutput.parse(result.json)).toStrictEqual({
      change: CHANGE,
      closedTickets: [ticket],
      rebuilt: true,
    });
    const record = readAttempts(h.store, DIR).find((found) => found.data.ticket === ticket);
    expect(record?.data).toMatchObject({ outcome: "not-run" });
    expect(record?.data["closed-at"]).toBeDefined();
    expect(record?.body).toBe("taken over\n");
    expect(transitions(h.store).at(-1)).toMatchObject({
      source: "kernel",
      to: "execute",
      refs: [ticket],
    });
    const list = await h.step(["attempt", "list", "--for", "01-1", "--json"]);
    expect(list.json).toMatchObject({
      budgets: { "task-redispatch": { used: 1 }, "not-run": { used: 1 } },
    });
    expect((await open(h, "task-redispatch", "01-1")).code).toBe(0);
    expect((await h.run(["change", "takeover"])).stdout).toMatch(/^refused: /);
  });

  it("text output names the closed tickets", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    expect((await h.step(["change", "takeover", "--close-tickets"])).stdout).toBe(
      `took over ${CHANGE}: closed ${ticket} as not-run, state rebuilt\n`,
    );
  });
});

describe("change status parts", () => {
  it("lists the plan parts as part list does", async () => {
    const h = await started();
    h.git.commits = [["c1".repeat(20), "01", "01-1"]];
    const status = changeStatusOutput.parse((await h.run(["change", "status", "--json"])).json);
    const list = (await h.run(["part", "list", "--json"])).json as { items: unknown[] };
    expect(status.parts).toStrictEqual(list.items);
    expect(status.parts.map((part) => [part.part, part.state, part.done])).toStrictEqual([
      ["01", "started", 1],
      ["02", "blocked", 0],
    ]);
  });

  it("stays within 100 lines with 8 parts", async () => {
    const h = await started();
    for (const nn of ["03", "04", "05", "06", "07", "08"]) {
      writePlanPart(h.store, nn, { body: tasks(nn, 8), dependsOn: ["02"] });
    }
    const text = (await h.run(["change", "status"])).stdout;
    expect(text.split("\n").length).toBeLessThanOrEqual(100);
    // The new parts are not verified, so the plan is not done and part 01 is blocked again.
    expect(text).toContain("parts:\n  01 Part 01: blocked, 0/2 tasks\n");
    expect(text).toContain("  08 Part 08: blocked, 0/8 tasks\n");
  });
});
