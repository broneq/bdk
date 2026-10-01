// `kernel-cli/commit`: the task commit through the real registry over a
// Change in memory and a scripted git (`kernel-loops`, Diff check, Tiny guard).
import { describe, expect, it } from "vitest";

import { attemptRegistrations } from "../../attempt/index.ts";
import { setChange, writePlanPart } from "../../graph/tests/support.ts";
import { harness as partHarness, openTicket, tasks, DIR } from "../../part/tests/support.ts";
import type { Harness } from "../../part/tests/support.ts";
import type { PartDeps } from "../../part/index.ts";
import { ROOT } from "../../log/tests/support.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { LockWait } from "../../shared/store/index.ts";
import { commitRegistrations } from "../index.ts";
import { commitOutput } from "../schema/output.ts";

const CHANGE_DIR = ".bdk/changes/2026-09-25-login/";

const LOCK = `${ROOT}/.bdk/.machine/commit.lock`;

/** A lock wait on a clock that the sleeps move; `alive` answers for every other process. */
function lockWait(alive: boolean): LockWait & { slept: number } {
  let now = Date.parse("2026-09-25T10:00:00.000Z");
  const wait = {
    waitMs: 60_000,
    pollMs: 1_000,
    pid: 100,
    slept: 0,
    now: () => now,
    sleep: (ms: number) => {
      now += ms;
      wait.slept += ms;
      return Promise.resolve();
    },
    alive: () => alive,
  };
  return wait;
}

function harness(commitLock?: LockWait): Harness {
  return partHarness((deps: PartDeps) => [
    ...commitRegistrations(commitLock === undefined ? deps : { ...deps, commitLock }),
    ...attemptRegistrations(deps),
  ]);
}

/** A Change whose plan is done and part 01 started; `profile` defaults to small. */
async function started(profile = "small"): Promise<Harness> {
  const h = harness();
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: tasks("01", 2), doNotTouch: ["src/billing/**"] });
  expect((await h.run(["done", "plan"])).code).toBe(0);
  expect((await h.run(["part", "start", "01"])).code).toBe(0);
  if (profile !== "tiny") setChange(h.store, { profile });
  return h;
}

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string };
}

function findings(h: Harness) {
  return h.store
    .list(`${DIR}/log`)
    .filter((name) => name.includes("-finding-"))
    .map((name) => readDocument(h.store, `${DIR}/log/${name}`))
    .map((document) => (document !== undefined && "data" in document ? document.data : {}));
}

describe("commit lock (T41-D12)", () => {
  const held = JSON.stringify({ pid: 4242, owner: "02-3", at: "2026-09-25T09:59:00.000Z" });

  async function lockedStart(wait: LockWait): Promise<Harness> {
    const h = harness(wait);
    setChange(h.store, { profile: "tiny" });
    writePlanPart(h.store, "01", { body: tasks("01", 2), doNotTouch: ["src/billing/**"] });
    expect((await h.run(["done", "plan"])).code).toBe(0);
    expect((await h.run(["part", "start", "01"])).code).toBe(0);
    setChange(h.store, { profile: "small" });
    h.git.status = ["src/01-1.ts"];
    return h;
  }

  it("refuses with policy/commit-busy after 60 s of a live holder, creating no commit", async () => {
    const wait = lockWait(true);
    const h = await lockedStart(wait);
    h.store.write(LOCK, held);
    const result = await h.run(["commit", "01-1", "--message", "store it", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/commit-busy" });
    expect(refusal(result).why).toBe(
      "process 4242 has held .bdk/.machine/commit.lock for task 02-3 since 2026-09-25T09:59:00.000Z",
    );
    expect((result.json as { instead: string[] }).instead).toEqual([
      'bdk commit 01-1 --message "store it"',
    ]);
    expect(wait.slept).toBe(60_000);
    expect(h.git.committed).toEqual([]);
    expect(h.store.read(LOCK)).toBe(held);
  });

  it("takes over the lock of a process that no longer exists", async () => {
    const wait = lockWait(false);
    const h = await lockedStart(wait);
    h.store.write(LOCK, held);
    expect((await h.run(["commit", "01-1", "--json"])).code).toBe(0);
    expect(wait.slept).toBe(0);
    expect(h.store.exists(LOCK)).toBe(false);
  });

  it("takes over an unreadable lock file left long ago", async () => {
    const h = await lockedStart(lockWait(true));
    h.store.write(LOCK, "");
    expect((await h.run(["commit", "01-1", "--json"])).code).toBe(0);
  });

  it("releases the lock after a refusal", async () => {
    const h = await lockedStart(lockWait(true));
    h.git.status = [];
    expect(refusal(await h.run(["commit", "01-1", "--json"])).rule).toBe(
      "policy/nothing-to-commit",
    );
    expect(h.store.exists(LOCK)).toBe(false);
  });
});

describe("commit", () => {
  it("stages the task's paths, the undeclared ones and the Change directory, with the trailers", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts", "src/util.ts", `${CHANGE_DIR}log/e.md`];
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    const report = commitOutput.parse(result.json);
    expect(report).toMatchObject({
      task: "01-1",
      commit: "d8e4f21",
      trailers: { "BDK-Change": "2026-09-25-login", "BDK-Part": "01", "BDK-Task": "01-1" },
      files: ["src/01-1.ts", "src/util.ts", `${CHANGE_DIR}log/e.md`],
      undeclared: ["src/util.ts"],
    });
    expect(h.git.committed).toStrictEqual([
      [
        "commit",
        "--quiet",
        "--only",
        "-m",
        "Task 1",
        "-m",
        "BDK-Change: 2026-09-25-login\nBDK-Part: 01\nBDK-Task: 01-1",
        "--",
        "src/01-1.ts",
        "src/util.ts",
        CHANGE_DIR,
      ],
    ]);
    const finding = findings(h).find((entry) => entry.id === report.finding);
    expect(finding).toMatchObject({ source: "kernel", refs: ["01-1", "src/util.ts"] });
  });

  it("leaves a user-staged file out of the commit; --message sets the subject", async () => {
    const h = await started();
    h.git.status = ["M  README.md", " M src/01-1.ts"];
    const report = commitOutput.parse(
      (await h.run(["commit", "01-1", "--message", "Reject expired links", "--json"])).json,
    );
    expect(report.files).toStrictEqual(["src/01-1.ts"]);
    expect(report).not.toHaveProperty("undeclared");
    expect(h.git.committed[0]).toContain("Reject expired links");
    expect(h.git.committed[0]).not.toContain("README.md");
  });

  it("leaves a sibling task's declared path to the sibling", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts", "src/01-2.ts"];
    const report = commitOutput.parse((await h.run(["commit", "01-1", "--json"])).json);
    expect(report.files).toStrictEqual(["src/01-1.ts"]);
  });

  it("commits the Change directory alone when only it changed", async () => {
    const h = await started();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    const report = commitOutput.parse((await h.run(["commit", "01-1", "--json"])).json);
    expect(report.files).toStrictEqual([`${CHANGE_DIR}log/e.md`]);
  });

  it("refuses input/not-found for a task no part holds", async () => {
    const h = await started();
    const result = await h.run(["commit", "01-9", "--json"]);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/not-found");
  });

  it("refuses policy/do-not-touch and commits nothing", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts", "src/billing/a.ts"];
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(refusal(result)).toMatchObject({ rule: "policy/do-not-touch" });
    expect(h.git.committed).toStrictEqual([]);
  });

  it("refuses policy/ticket-open while a ticket of the task is open, not of a sibling", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts"];
    openTicket(h.store, "A-00000001", "01-2");
    expect((await h.run(["commit", "01-1", "--json"])).code).toBe(0);
    openTicket(h.store, "A-00000002", "01-1");
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(refusal(result)).toMatchObject({
      rule: "policy/ticket-open",
      why: "ticket A-00000002 of 01-1 is still open",
    });
  });

  it("refuses policy/nothing-to-commit", async () => {
    const h = await started();
    h.git.status = ["src/01-2.ts"];
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/nothing-to-commit");
  });

  it("refuses policy/git-hook-failed with the hook's first line", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts"];
    h.git.commitResult = { code: 1, stdout: "", stderr: "\nlint failed: src/01-1.ts\nmore\n" };
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(refusal(result)).toMatchObject({
      rule: "policy/git-hook-failed",
      why: "a git hook rejected the commit of 01-1: lint failed: src/01-1.ts",
    });
  });

  it("the tiny guard records one finding over 2 files, none again for the same numbers", async () => {
    const h = await started("tiny");
    h.git.commits = [["c1".repeat(20), "01", "01-1"]];
    h.git.numstat = "1\t1\tsrc/01-1.ts\x001\t1\tsrc/01-2.ts\x001\t1\tsrc/util.ts\x00";
    h.git.status = ["src/01-1.ts"];
    expect((await h.run(["commit", "01-1", "--json"])).code).toBe(0);
    const guard = () =>
      findings(h).filter((entry) => String(entry.summary).startsWith("tiny Change outgrew"));
    expect(guard()).toHaveLength(1);
    expect(guard()[0]).toMatchObject({ review: true, source: "kernel" });
    expect(String(guard()[0]?.summary)).toContain("files 3");
    h.git.status = ["src/01-2.ts"];
    expect((await h.run(["commit", "01-2", "--json"])).code).toBe(0);
    expect(guard()).toHaveLength(1);
  });

  it("text output names the commit", async () => {
    const h = await started();
    h.git.status = ["src/01-1.ts"];
    expect((await h.run(["commit", "01-1"])).stdout).toBe("01-1 committed as d8e4f21 (1 file)\n");
  });
});
