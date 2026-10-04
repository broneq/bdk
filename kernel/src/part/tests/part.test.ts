// `kernel-cli/part`: `part list`, `start`, `done` and `split` through the
// real registry over a Change in memory and a scripted git.
import { describe, expect, it } from "vitest";

import {
  passGate,
  setChange,
  writeDesign,
  writeDesignVerdict,
  writeEntry,
  writePlanPart,
} from "../../graph/tests/support.ts";
import { readDocument } from "../../shared/store/index.ts";
import {
  partDoneOutput,
  partListOutput,
  partSplitOutput,
  partStartOutput,
} from "../schema/outputs.ts";
import { DIR, harness, openTicket, tasks } from "./support.ts";
import type { Harness } from "./support.ts";

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T10:05:00.000Z";
const T2 = "2026-09-25T10:10:00.000Z";
const T3 = "2026-09-25T10:15:00.000Z";
const HASH = (c: string) => c.repeat(40);

/** A tiny Change whose plan is done: part 01 with tasks 01-1 and 01-2, part 02 after 01. */
async function planned(h: Harness = harness()): Promise<Harness> {
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: tasks("01", 2) });
  writePlanPart(h.store, "02", { body: tasks("02", 1), dependsOn: ["01"] });
  const done = await h.run(["done", "plan", "--json"], T0);
  expect(done.code, done.stdout).toBe(0);
  return h;
}

function items(result: { json: unknown }) {
  return partListOutput.parse(result.json).items;
}

describe("part list", () => {
  it("answers an empty list without plan parts", async () => {
    const h = harness();
    expect(partListOutput.parse((await h.run(["part", "list", "--json"])).json)).toStrictEqual({
      items: [],
      total: 0,
      truncated: false,
    });
  });

  it("derives ready, blocked, started, done and stale with counts from trailers", async () => {
    const h = await planned();
    expect(items(await h.run(["part", "list", "--json"], T1))).toStrictEqual([
      {
        part: "01",
        title: "Part 01",
        state: "ready",
        tasks: 2,
        done: 0,
        bytes: expect.any(Number) as number,
        specImpact: "none",
        wave: 1,
      },
      {
        part: "02",
        title: "Part 02",
        state: "blocked",
        tasks: 1,
        done: 0,
        bytes: expect.any(Number) as number,
        dependsOn: ["01"],
        specImpact: "none",
        wave: 2,
      },
    ]);
    await h.run(["part", "start", "01"], T1);
    h.git.commits = [[HASH("a"), "01", "01-1"]];
    expect(items(await h.run(["part", "list", "--json"], T2))[0]).toMatchObject({
      state: "started",
      done: 1,
    });
    h.git.commits = [
      [HASH("b"), "01", "01-2"],
      [HASH("a"), "01", "01-1"],
    ];
    expect((await h.run(["part", "done", "01"], T2)).code).toBe(0);
    expect(items(await h.run(["part", "list", "--json"], T3))[0]).toMatchObject({
      state: "done",
      done: 2,
    });
    const path = `${DIR}/plan/parts/01-part.md`;
    h.store.write(path, `${h.store.read(path) ?? ""}\nMore notes.\n`);
    expect(items(await h.run(["part", "list", "--json"], T3))[0]).toMatchObject({ state: "stale" });
  });

  it("lists a part without spec-impact as none", async () => {
    const h = harness();
    writePlanPart(h.store, "01", { specImpact: "absent" });
    const [item] = items(await h.run(["part", "list", "--json"]));
    expect(item).toMatchObject({ part: "01", specImpact: "none" });
  });

  it("lists an oversized part with its bytes", async () => {
    const h = harness();
    writePlanPart(h.store, "03", {
      body: `${tasks("03", 1)}\n${"x".repeat(9000)}\n`,
      specImpact: "[auth]",
    });
    const [item] = items(await h.run(["part", "list", "--json"]));
    expect(item?.bytes).toBeGreaterThan(9000);
    expect(item).toMatchObject({ part: "03", state: "blocked", specImpact: "delta" });
    expect((await h.run(["part", "list"])).stdout).toContain("03 blocked: Part 03");
  });
});

describe("part start", () => {
  it("refuses policy/not-ready naming the requirement", async () => {
    const h = await planned();
    const result = await h.run(["part", "start", "02", "--json"], T1);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/not-ready",
      why: "execute-part:02 is blocked: execute-part:01 is ready, not done",
    });
  });

  it("refuses input/not-found for an unknown part", async () => {
    const h = await planned();
    const result = await h.run(["part", "start", "07", "--json"], T1);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({
      rule: "input/not-found",
      why: "plan/parts/ holds no part 07; parts: 01, 02",
    });
  });

  it.each([
    ["policy/part-too-large", (body: string) => `${body}\n${"x".repeat(8200)}\n`],
    ["policy/placeholder", (body: string) => body.replace("- works", "- TODO")],
    [
      "policy/validation-failed",
      (body: string) => body.replace("**Test cases:**\n\n- works\n", ""),
    ],
  ])("refuses %s from the plan part checks and writes nothing", async (rule, edit) => {
    const h = await planned();
    const path = `${DIR}/plan/parts/01-part.md`;
    const text = h.store.read(path) ?? "";
    h.store.write(path, edit(text));
    await h.run(["done", "plan"], T1);
    const before = h.store.list(`${DIR}/log`);
    const result = await h.run(["part", "start", "01", "--json"], T1);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule });
    expect(h.store.list(`${DIR}/log`)).toStrictEqual(before);
  });

  it("refuses policy/validation-failed naming isolation for a worktree part without a reason", async () => {
    const h = await planned();
    const path = `${DIR}/plan/parts/01-part.md`;
    h.store.write(
      path,
      (h.store.read(path) ?? "").replace("schema: 1\n", "schema: 1\nisolation: worktree\n"),
    );
    await h.run(["done", "plan"], T1);
    const result = await h.run(["part", "start", "01", "--json"], T1);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/validation-failed" });
    expect((result.json as { why: string }).why).toContain("fails check isolation");
  });

  it("refuses runtime/git-too-old for a worktree part on git 2.37 and writes nothing", async () => {
    const h = await planned();
    const path = `${DIR}/plan/parts/01-part.md`;
    h.store.write(
      path,
      (h.store.read(path) ?? "").replace(
        "schema: 1\n",
        "schema: 1\nisolation: worktree\nisolation-reason: both regenerate the lockfile\n",
      ),
    );
    await h.run(["done", "plan"], T1);
    const run = h.git.run.bind(h.git);
    h.git.run = (args, cwd) =>
      args[0] === "--version"
        ? Promise.resolve({ code: 0, stdout: "git version 2.37.1\n", stderr: "" })
        : run(args, cwd);
    const before = h.store.list(`${DIR}/log`);
    const result = await h.run(["part", "start", "01", "--json"], T1);
    expect(result.code).toBe(5);
    expect(result.json).toMatchObject({ rule: "runtime/git-too-old" });
    expect((result.json as { why: string }).why).toContain("2.38");
    expect(h.store.list(`${DIR}/log`)).toStrictEqual(before);
  });

  it("refuses policy/do-not-touch-overlap before readiness", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    writePlanPart(h.store, "01", { body: tasks("01", 1), doNotTouch: ["src/**"] });
    const result = await h.run(["part", "start", "01", "--json"], T1);
    expect(result.json).toMatchObject({
      rule: "policy/do-not-touch-overlap",
      why: "plan-part:01 fails check do-not-touch: task 01-1 declares src/01-1.ts, which do-not-touch src/** forbids",
    });
  });

  it("writes the start marker without input-hash and moves the stage to execute", async () => {
    const h = await planned();
    writePlanPart(h.store, "01", {
      body: tasks("01", 2).replace("- works", "- works\n\n**Stop rule:** stop after two tries"),
      doNotTouch: ["docs/**"],
    });
    await h.run(["done", "plan"], T0);
    const report = partStartOutput.parse((await h.run(["part", "start", "01", "--json"], T1)).json);
    expect(report).toStrictEqual({
      part: "01",
      state: "started",
      tasks: [
        { task: "01-1", files: ["src/01-1.ts"], stopRule: "stop after two tries" },
        { task: "01-2", files: ["src/01-2.ts"] },
      ],
      doNotTouch: ["docs/**"],
      successMeasure: "m",
      entry: report.entry,
      isolation: "shared",
    });
    const marker = h.store.list(`${DIR}/log`).find((name) => name.includes(report.entry));
    const document = readDocument(h.store, `${DIR}/log/${marker ?? ""}`);
    const data = document !== undefined && "data" in document ? document.data : {};
    expect(data).toMatchObject({ type: "transition", to: "execute-part:01", source: "kernel" });
    expect(data).not.toHaveProperty("input-hash");
    const explain = (await h.run(["explain", "execute-part:01", "--json"], T2)).json;
    expect(explain).toMatchObject({ state: "ready" });
    expect((await h.run(["change", "status", "--json"], T2)).json).toMatchObject({
      stage: "execute",
    });
  });

  it("refuses policy/invalid-transition when started or done", async () => {
    const h = await planned();
    await h.run(["part", "start", "01"], T1);
    const again = await h.run(["part", "start", "01", "--json"], T1);
    expect(again.json).toMatchObject({
      rule: "policy/invalid-transition",
      why: "part 01 is already started",
    });
    h.git.commits = [
      [HASH("b"), "01", "01-2"],
      [HASH("a"), "01", "01-1"],
    ];
    await h.run(["part", "done", "01"], T2);
    const done = await h.run(["part", "start", "01", "--json"], T3);
    expect(done.json).toMatchObject({
      rule: "policy/invalid-transition",
      why: "part 01 is already done",
    });
  });
});

describe("part done", () => {
  async function started(): Promise<Harness> {
    const h = await planned();
    await h.run(["part", "start", "01"], T1);
    return h;
  }

  it("refuses policy/invalid-transition when not started", async () => {
    const h = await planned();
    const result = await h.run(["part", "done", "01", "--json"], T1);
    expect(result.json).toMatchObject({
      rule: "policy/invalid-transition",
      why: "part 01 is not started",
    });
  });

  it("refuses policy/ticket-open while a ticket of a task is open", async () => {
    const h = await started();
    h.git.commits = [[HASH("a"), "01", "01-1"]];
    openTicket(h.store, "A-7h3k9m2p", "01-2");
    const result = await h.run(["part", "done", "01", "--json"], T2);
    expect(result.json).toMatchObject({
      rule: "policy/ticket-open",
      why: "ticket A-7h3k9m2p is open on 01-2",
    });
  });

  it("refuses policy/validation-failed naming a task without a commit", async () => {
    const h = await started();
    h.git.commits = [[HASH("a"), "01", "01-1"]];
    const result = await h.run(["part", "done", "01", "--json"], T2);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/validation-failed",
      why: "execute-part:01 fails check commits: task 01-2 has no commit carrying BDK-Part: 01 and BDK-Task: 01-2",
      instead: ["bdk commit 01-2", "bdk validate execute-part:01"],
    });
  });

  it("refuses state/trailer-mismatch naming both sides", async () => {
    const h = await started();
    h.git.commits = [[HASH("c"), "01", "01-9"]];
    const result = await h.run(["part", "done", "01", "--json"], T2);
    expect(result.code).toBe(4);
    expect(result.json).toMatchObject({
      rule: "state/trailer-mismatch",
      why: "commit ccccccc carries BDK-Task: 01-9, but no plan part holds 01-9",
    });
  });

  it("writes the done marker with the part hash, lists open findings and names next", async () => {
    const h = await started();
    h.git.commits = [
      [HASH("b"), "01", "01-2"],
      [HASH("a"), "01", "01-1"],
    ];
    const finding = writeEntry(h.store, {
      type: "finding",
      at: T1,
      status: "proposed",
      refs: ["01-2"],
    });
    writeEntry(h.store, { type: "finding", at: T1, status: "proposed", refs: ["02-1"] });
    const report = partDoneOutput.parse((await h.run(["part", "done", "01", "--json"], T2)).json);
    expect(report).toStrictEqual({
      part: "01",
      state: "done",
      commits: [
        { task: "01-1", commit: "aaaaaaa" },
        { task: "01-2", commit: "bbbbbbb" },
      ],
      openFindings: [finding],
      entry: report.entry,
      next: "execute-part:02",
    });
    const hash = (await h.run(["validate", "plan-part:01", "--json"], T3)).json as {
      inputHash: string;
    };
    const explain = async () =>
      (
        (await h.run(["explain", "execute-part:01", "--json"], T3)).json as {
          chain: { id: string; state: string; inputHash?: string }[];
        }
      ).chain[0];
    expect(await explain()).toMatchObject({
      id: "execute-part:01",
      state: "done",
      inputHash: hash.inputHash,
    });
    const again = await h.run(["part", "done", "01", "--json"], T3);
    expect(again.json).toMatchObject({ rule: "policy/invalid-transition" });
    const path = `${DIR}/plan/parts/01-part.md`;
    h.store.write(path, `${h.store.read(path) ?? ""}\nMore notes.\n`);
    expect(await explain()).toMatchObject({ state: "stale" });
  });

  it("the tiny guard records one review finding when the Change outgrows tiny", async () => {
    const h = await started();
    h.git.commits = [
      [HASH("b"), "01", "01-2"],
      [HASH("a"), "01", "01-1"],
    ];
    h.git.numstat = "10\t0\tsrc/a.ts\x0010\t0\tsrc/b.ts\x0010\t0\tlib/c.ts\x00";
    expect((await h.run(["part", "done", "01"], T2)).code).toBe(0);
    const findings = () => h.store.list(`${DIR}/log`).filter((name) => name.includes("-finding-"));
    expect(findings()).toHaveLength(1);
    const [name] = findings();
    const document = readDocument(h.store, `${DIR}/log/${name ?? ""}`);
    expect(document !== undefined && "data" in document ? document.data : {}).toMatchObject({
      review: true,
      source: "kernel",
      summary: expect.stringContaining("files 3") as unknown,
    });
    await h.run(["part", "start", "02"], T3);
    h.git.commits = [[HASH("d"), "02", "02-1"], ...h.git.commits];
    expect((await h.run(["part", "done", "02"], T3)).code).toBe(0);
    expect(findings()).toHaveLength(1);
  });
});

describe("part split", () => {
  /** A small Change past plan-verify with part 02 of four tasks and part 03 after 02. */
  async function verified(): Promise<Harness> {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    writeDesignVerdict(h.store, T0);
    await h.run(["done", "design-verify"], T0);
    passGate(h.store, "gate:design", "plan", T1);
    writePlanPart(h.store, "01", { body: tasks("01", 1) });
    writePlanPart(h.store, "02", {
      body: tasks("02", 4),
      dependsOn: ["01"],
      doNotTouch: ["docs/**"],
    });
    writePlanPart(h.store, "03", { body: tasks("03", 1), dependsOn: ["02"] });
    await h.run(["done", "plan"], T1);
    h.store.write(
      `${DIR}/reports/plan-verify-plan-verifier-A-00000001.md`,
      "---\nschema: 1\nticket: A-00000001\nrole: plan-verifier\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n",
    );
    writeEntry(h.store, {
      type: "report",
      at: T1,
      source: "agent:plan-verifier",
      refs: ["plan-verify"],
      report: "reports/plan-verify-plan-verifier-A-00000001.md",
    });
    const done = await h.run(["done", "plan-verify", "--json"], T2);
    expect(done.code, done.stdout).toBe(0);
    return h;
  }

  function data(h: Harness, path: string): Record<string, unknown> {
    const document = readDocument(h.store, `${DIR}/${path}`);
    return document !== undefined && "data" in document ? { ...document.data } : {};
  }

  it("moves tasks to a new part, extends dependents, regenerates the index and re-verifies", async () => {
    const h = await verified();
    const report = partSplitOutput.parse(
      (await h.run(["part", "split", "02", "02-3,02-4", "--json"], T3)).json,
    );
    expect(report).toStrictEqual({
      part: "02",
      newPart: "04",
      moved: ["02-3", "02-4"],
      entry: report.entry,
    });
    const created = h.store.list(`${DIR}/plan/parts`).find((name) => name.startsWith("04-"));
    expect(created).toBe("04-task-3.md");
    expect(data(h, `plan/parts/${created ?? ""}`)).toMatchObject({
      id: "04",
      title: "Part 02 (split from 02)",
      "depends-on": ["01"],
      "do-not-touch": ["docs/**"],
    });
    const moved = h.store.read(`${DIR}/plan/parts/${created ?? ""}`) ?? "";
    expect(moved).toContain("## 02-3 Task 3");
    expect(moved).toContain("## 02-4 Task 4");
    const kept = h.store.read(`${DIR}/plan/parts/02-part.md`) ?? "";
    expect(kept).toContain("## 02-2 Task 2");
    expect(kept).not.toContain("02-3");
    expect(data(h, "plan/parts/03-part.md")["depends-on"]).toStrictEqual(["02", "04"]);
    expect(data(h, "plan/index.md").parts).toStrictEqual([
      { id: "01", title: "Part 01", "depends-on": [], wave: 1 },
      { id: "02", title: "Part 02", "depends-on": ["01"], wave: 2 },
      { id: "03", title: "Part 03", "depends-on": ["02", "04"], wave: 3 },
      { id: "04", title: "Part 02 (split from 02)", "depends-on": ["01"], wave: 2 },
    ]);
    const decision = h.store.list(`${DIR}/log`).find((name) => name.includes(report.entry)) ?? "";
    expect(data(h, `log/${decision}`)).toMatchObject({
      type: "decision",
      source: "kernel",
      refs: ["plan/parts/02-part.md", `plan/parts/${created ?? ""}`, "02-3", "02-4"],
    });
    expect((await h.run(["explain", "plan-verify", "--json"], T3)).json).toMatchObject({
      state: "stale",
    });
    expect((await h.run(["explain", "plan-part:02", "--json"], T3)).json).toMatchObject({
      state: "stale",
    });
  });

  it("refuses to move every task or a task the part does not hold", async () => {
    const h = await verified();
    const all = await h.run(["part", "split", "02", "02-1,02-2,02-3,02-4", "--json"], T3);
    expect(all.json).toMatchObject({ rule: "input/invalid-argument" });
    const stranger = await h.run(["part", "split", "02", "03-1", "--json"], T3);
    expect(stranger.json).toMatchObject({
      rule: "input/invalid-argument",
      why: "part 02 holds no task 03-1; it holds 02-1, 02-2, 02-3, 02-4",
    });
  });

  it("refuses a committed task, an open ticket and a done part", async () => {
    const h = await verified();
    h.git.commits = [[HASH("a"), "02", "02-3"]];
    expect((await h.run(["part", "split", "02", "02-3", "--json"], T3)).json).toMatchObject({
      rule: "policy/invalid-transition",
      why: "task 02-3 has commit aaaaaaa; a committed task stays in its part",
    });
    openTicket(h.store, "A-7h3k9m2p", "02-4");
    expect((await h.run(["part", "split", "02", "02-4", "--json"], T3)).json).toMatchObject({
      rule: "policy/ticket-open",
    });
  });

  it("refuses a done part", async () => {
    const h = await planned();
    await h.run(["part", "start", "01"], T1);
    h.git.commits = [
      [HASH("b"), "01", "01-2"],
      [HASH("a"), "01", "01-1"],
    ];
    expect((await h.run(["part", "done", "01"], T2)).code).toBe(0);
    expect((await h.run(["part", "split", "01", "01-2", "--json"], T3)).json).toMatchObject({
      rule: "policy/invalid-transition",
      why: "part 01 is done; a done part is not split",
    });
  });
});
