// `kernel-cli/commit`: the review fix commit through the real registry over a
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

const CHANGE = "2026-09-25-login";
const CHANGE_DIR = `.bdk/changes/${CHANGE}/`;
const TICKET = "A-r2v2w3x4";

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
async function started(profile = "small", commitLock?: LockWait): Promise<Harness> {
  const h = harness(commitLock);
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: tasks("01", 2), doNotTouch: ["src/billing/**"] });
  expect((await h.run(["done", "plan"])).code).toBe(0);
  expect((await h.run(["part", "start", "01"])).code).toBe(0);
  if (profile !== "tiny") setChange(h.store, { profile });
  return h;
}

/** `started`, every task committed and a review-fix ticket open: the review stage follows execute. */
async function fixing(profile = "small", commitLock?: LockWait): Promise<Harness> {
  const h = await started(profile, commitLock);
  h.git.commits = [
    ["c2".repeat(20), "01", "01-2"],
    ["c1".repeat(20), "01", "01-1"],
  ];
  openTicket(h.store, TICKET, CHANGE, "review-fix");
  return h;
}

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string; instead: string[] };
}

function findings(h: Harness) {
  return h.store
    .list(`${DIR}/log`)
    .filter((name) => name.includes("-finding-"))
    .map((name) => readDocument(h.store, `${DIR}/log/${name}`))
    .map((document) => (document !== undefined && "data" in document ? document.data : {}));
}

describe("commit lock (T41-D12)", () => {
  const held = JSON.stringify({ pid: 4242, owner: CHANGE, at: "2026-09-25T09:59:00.000Z" });

  async function locked(wait: LockWait): Promise<Harness> {
    const h = await fixing("small", wait);
    h.git.status = ["src/util.ts"];
    return h;
  }

  it("refuses with policy/commit-busy after 60 s of a live holder, creating no commit", async () => {
    const wait = lockWait(true);
    const h = await locked(wait);
    h.store.write(LOCK, held);
    const result = await h.run(["commit", CHANGE, "--message", "store it", "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/commit-busy" });
    expect(refusal(result).why).toBe(
      `process 4242 has held .bdk/.machine/commit.lock for ${CHANGE} since 2026-09-25T09:59:00.000Z`,
    );
    expect(refusal(result).instead).toEqual([`bdk commit ${CHANGE} --message "store it"`]);
    expect(wait.slept).toBe(60_000);
    expect(h.git.committed).toEqual([]);
    expect(h.store.read(LOCK)).toBe(held);
  });

  it("takes over the lock of a process that no longer exists", async () => {
    const wait = lockWait(false);
    const h = await locked(wait);
    h.store.write(LOCK, held);
    expect((await h.run(["commit", CHANGE, "--json"])).code).toBe(0);
    expect(wait.slept).toBe(0);
    expect(h.store.exists(LOCK)).toBe(false);
  });

  it("takes over an unreadable lock file left long ago", async () => {
    const h = await locked(lockWait(true));
    h.store.write(LOCK, "");
    expect((await h.run(["commit", CHANGE, "--json"])).code).toBe(0);
  });

  it("releases the lock after a refusal", async () => {
    const h = await locked(lockWait(true));
    h.git.status = [];
    expect(refusal(await h.run(["commit", CHANGE, "--json"])).rule).toBe(
      "policy/nothing-to-commit",
    );
    expect(h.store.exists(LOCK)).toBe(false);
  });
});

describe("commit", () => {
  it("commits every touched path and the Change directory with BDK-Ticket, the ticket open", async () => {
    const h = await fixing();
    h.git.status = ["src/util.ts", "src/01-1.ts", `${CHANGE_DIR}log/e.md`];
    const result = await h.run(["commit", CHANGE, "--json"]);
    expect(result.code, result.stdout).toBe(0);
    const report = commitOutput.parse(result.json);
    expect(report).toStrictEqual({
      ticket: TICKET,
      commit: "d8e4f21",
      trailers: { "BDK-Change": CHANGE, "BDK-Ticket": TICKET },
      files: ["src/01-1.ts", "src/util.ts", `${CHANGE_DIR}log/e.md`],
    });
    expect(h.git.committed).toStrictEqual([
      [
        "commit",
        "--quiet",
        "--only",
        "-m",
        `fix(review): ${TICKET}`,
        "-m",
        `BDK-Change: ${CHANGE}\nBDK-Ticket: ${TICKET}`,
        "--",
        "src/01-1.ts",
        "src/util.ts",
        CHANGE_DIR,
      ],
    ]);
    expect(findings(h)).toStrictEqual([]);
    const record = readDocument(h.store, `${DIR}/attempts/review-fix-${CHANGE}-${TICKET}.md`);
    expect(record).not.toMatchObject({ data: { outcome: expect.anything() as unknown } });
  });

  it("leaves a user-staged path staged and out of the commit; --message sets the subject", async () => {
    const h = await fixing();
    h.git.status = ["M  README.md", " M src/util.ts"];
    const report = commitOutput.parse(
      (await h.run(["commit", CHANGE, "--message", "Validate the token", "--json"])).json,
    );
    expect(report.files).toStrictEqual(["src/util.ts"]);
    expect(h.git.committed[0]).toContain("Validate the token");
    expect(h.git.committed[0]).not.toContain("README.md");
  });

  it("commits the Change directory alone when only it changed", async () => {
    const h = await fixing();
    h.git.status = [`${CHANGE_DIR}log/e.md`];
    const report = commitOutput.parse((await h.run(["commit", CHANGE, "--json"])).json);
    expect(report.files).toStrictEqual([`${CHANGE_DIR}log/e.md`]);
  });

  it("commits a path under a part's do-not-touch (#160)", async () => {
    const h = await fixing();
    h.git.status = ["src/util.ts", "src/billing/a.ts"];
    const report = commitOutput.parse((await h.run(["commit", CHANGE, "--json"])).json);
    expect(report.files).toStrictEqual(["src/billing/a.ts", "src/util.ts"]);
  });

  it("refuses a task id with input/invalid-argument naming bdk check run (#166)", async () => {
    const h = await started();
    openTicket(h.store, "A-00000001", "01", "part");
    h.git.status = ["src/01-1.ts"];
    const result = await h.run(["commit", "01-1", "--json"]);
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({
      rule: "input/invalid-argument",
      instead: ["bdk check run 01-1 --ticket A-00000001"],
    });
    expect(h.git.committed).toStrictEqual([]);
  });

  it("refuses input/not-found for an id that is not the active Change", async () => {
    const h = await fixing();
    const result = await h.run(["commit", "2026-01-01-other", "--json"]);
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({
      rule: "input/not-found",
      instead: [`bdk commit ${CHANGE}`],
    });
  });

  it("refuses policy/no-open-ticket without an open review-fix ticket, committing nothing", async () => {
    const h = await started();
    openTicket(h.store, "A-00000001", "01", "part");
    h.git.status = ["src/util.ts"];
    const result = await h.run(["commit", CHANGE, "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/no-open-ticket" });
    expect(h.git.committed).toStrictEqual([]);
  });

  it("refuses policy/nothing-to-commit", async () => {
    const h = await fixing();
    h.git.status = [];
    const result = await h.run(["commit", CHANGE, "--json"]);
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/nothing-to-commit");
  });

  it("refuses policy/git-hook-failed with the hook's first line", async () => {
    const h = await fixing();
    h.git.status = ["src/util.ts"];
    h.git.commitResult = { code: 1, stdout: "", stderr: "\nlint failed: src/util.ts\nmore\n" };
    const result = await h.run(["commit", CHANGE, "--json"]);
    expect(refusal(result)).toMatchObject({
      rule: "policy/git-hook-failed",
      why: `a git hook rejected the review fix of ${TICKET}: lint failed: src/util.ts`,
    });
  });

  it("the tiny guard records one finding over 2 files, none again for the same numbers", async () => {
    const h = await fixing("tiny");
    h.git.numstat = "1\t1\tsrc/01-1.ts\x001\t1\tsrc/01-2.ts\x001\t1\tsrc/util.ts\x00";
    h.git.status = ["src/util.ts"];
    expect((await h.run(["commit", CHANGE, "--json"])).code).toBe(0);
    const guard = () =>
      findings(h).filter((entry) => String(entry.summary).startsWith("tiny Change outgrew"));
    expect(guard()).toHaveLength(1);
    expect(guard()[0]).toMatchObject({ review: true, source: "kernel" });
    expect(String(guard()[0]?.summary)).toContain("files 3");
    expect((await h.run(["commit", CHANGE, "--json"])).code).toBe(0);
    expect(guard()).toHaveLength(1);
  });

  it("text output names the ticket", async () => {
    const h = await fixing();
    h.git.status = ["src/util.ts"];
    expect((await h.run(["commit", CHANGE])).stdout).toBe(
      `review fix of ${TICKET} committed as d8e4f21 (1 file)\n`,
    );
  });
});
