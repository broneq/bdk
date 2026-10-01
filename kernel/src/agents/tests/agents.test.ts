// `bdk agents list|show|wait` (`kernel-cli/agents`) through the registry on a
// memory repository: the filters, the part ref that reaches a lead, the text
// mode, and every event of `wait` on a clock its sleeps move. The E2E file
// `agents.e2e.ts` runs the same commands through the bundle.
import { describe, expect, it } from "vitest";

import { writePlanPart } from "../../graph/tests/support.ts";
import {
  harness,
  LEAD,
  openTicket,
  SCOUT,
  spawn,
  start,
  T0,
  TICKET,
  PACKAGE,
  WORKER,
} from "../../hooks/tests/agent-support.ts";
import type { Harness } from "../../hooks/tests/agent-support.ts";
import { CHANGE, ROOT, writePackage } from "../../log/tests/support.ts";
import { agentsRegistryPath } from "../../shared/store/index.ts";
import { agentsListOutput, agentsShowOutput, agentsWaitOutput } from "../schema/outputs.ts";

const PART_TICKET = "A-00000002";

/** Part 02 with tasks 02-1 and 02-3, the tree of `tree`, and the lead on the part-lead ticket of 02. */
async function part(h: Harness): Promise<void> {
  writePlanPart(h.store, "02", {
    body: "## 02-1 Store the token\n\n**Files:**\n\n- Create: `src/store.ts`\n\n**Verification:** none\n\n## 02-3 Verify the link\n\n**Files:**\n\n- Create: `src/verify.ts`\n\n**Verification:** none\n",
  });
  openTicket(h.store, PART_TICKET, "02", "part-lead");
  writePackage(h.store, PART_TICKET, "lead", "02");
  openTicket(h.store, TICKET, "02-3");
  writePackage(h.store, TICKET, "implementer", "02-3");
  const lead = `Read .bdk/changes/${CHANGE}/dispatch/02-lead-${PART_TICKET}.md.`;
  await h.run(["hooks", "post-tool"], spawn(undefined, LEAD, "bdk:lead", lead));
  await h.run(["hooks", "subagent-start"], start(LEAD, "bdk:lead"));
  h.tick(1);
  await h.run(["hooks", "post-tool"], spawn(LEAD, WORKER, "bdk:worker", `Read ${PACKAGE}.`));
  await h.run(["hooks", "subagent-start"], start(WORKER, "bdk:worker"));
}

async function ids(h: Harness, ...flags: string[]): Promise<string[]> {
  const result = await h.run(["agents", "list", ...flags, "--json"]);
  expect(result.code, result.stdout).toBe(0);
  return agentsListOutput.parse(result.json).agents.map((agent) => agent.id);
}

async function entry(h: Harness, ref: string): Promise<string> {
  const result = await h.run(["log", "add", "finding", "token changes", "--ref", ref, "--json"]);
  return (result.json as { entry: { id: string } }).entry.id;
}

async function wait(h: Harness, ...flags: string[]) {
  const result = await h.run(["agents", "wait", LEAD, ...flags, "--json"]);
  expect(result.code, result.stdout).toBe(0);
  return agentsWaitOutput.parse(result.json);
}

async function storeReport(h: Harness): Promise<void> {
  const envelope = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";
  expect((await h.run(["log", "ingest", "--ticket", TICKET, "--json"], envelope)).code).toBe(0);
}

describe("agents list", () => {
  it("lists the tree and filters it by parent and state", async () => {
    const h = harness();
    await part(h);
    expect(await ids(h)).toEqual([LEAD, WORKER]);
    expect(await ids(h, "--children-of", LEAD)).toEqual([WORKER]);
    expect(await ids(h, "--state", "ended")).toEqual([]);
    await h.run(["hooks", "post-tool"], spawn(undefined, SCOUT, "bdk:scout", "q", "completed"));
    expect(await ids(h, "--state", "ended")).toEqual([SCOUT]);
    expect(await ids(h, "--all")).toEqual([LEAD, WORKER, SCOUT]);
  });

  it("reaches the lead with a part ref and the worker with a file ref", async () => {
    const h = harness();
    await part(h);
    expect(await ids(h, "--affected-by", await entry(h, "02"))).toEqual([LEAD, WORKER]);
    expect(await ids(h, "--affected-by", await entry(h, "src/store.ts"))).toEqual([LEAD]);
    expect(await ids(h, "--affected-by", await entry(h, "src/verify.ts"))).toEqual([LEAD, WORKER]);
  });

  it("prints one line per agent, and a project without a registry has none", async () => {
    const h = harness();
    await part(h);
    const text = (await h.run(["agents", "list"])).stdout;
    expect(text).toContain(
      `${WORKER}  bdk:worker  running  parent ${LEAD}  target 02-3  ticket ${TICKET}`,
    );
    h.store.remove(agentsRegistryPath(ROOT));
    expect((await h.run(["agents", "list"])).stdout).toBe("No agents.\n");
  });

  it("refuses an unknown state and an entry the Change does not hold", async () => {
    const h = harness();
    await part(h);
    const state = await h.run(["agents", "list", "--state", "busy", "--json"]);
    expect(state.json).toMatchObject({ rule: "input/invalid-argument" });
    const missing = await h.run(["agents", "list", "--affected-by", "L-00000000", "--json"]);
    expect(missing.json).toMatchObject({ rule: "input/not-found" });
  });
});

describe("agents show", () => {
  it("shows an agent with its children in both modes", async () => {
    const h = harness();
    await part(h);
    const json = agentsShowOutput.parse((await h.run(["agents", "show", LEAD, "--json"])).json);
    expect(json).toMatchObject({ id: LEAD, parent: "main", target: "02", ticket: PART_TICKET });
    expect(json.children).toEqual([
      { id: WORKER, type: "bdk:worker", state: "running", target: "02-3" },
    ]);
    const text = (await h.run(["agents", "show", LEAD])).stdout;
    expect(text).toContain(`- ${WORKER}  bdk:worker  running  target 02-3`);
    expect(text).toContain("ended: -");
    const worker = (await h.run(["agents", "show", WORKER])).stdout;
    expect(worker).toContain("children: none");
  });

  it("shows how an agent ended, and refuses an unknown id", async () => {
    const h = harness();
    await part(h);
    await h.run(["hooks", "post-tool"], {
      tool_name: "TaskStop",
      tool_input: { task_id: WORKER },
      tool_response: { task_type: "local_agent" },
    });
    expect((await h.run(["agents", "show", WORKER])).stdout).toMatch(/ended: task-stop at /);
    const missing = await h.run(["agents", "show", "nobody", "--json"]);
    expect(missing.json).toMatchObject({ rule: "input/not-found" });
  });
});

describe("agents wait", () => {
  it("returns a stored report once, then times out with elapsed", async () => {
    const h = harness();
    await part(h);
    await storeReport(h);
    const first = await wait(h, "--timeout", "10");
    expect(first.events).toEqual([
      { kind: "report", agent: WORKER, ticket: TICKET, status: "done" },
    ]);
    const second = await wait(h, "--timeout", "10");
    expect(second.events).toEqual([{ kind: "timeout" }]);
    expect(second.elapsed).toBeGreaterThanOrEqual(10);
  });

  it("returns a child that turned suspect and one that ended", async () => {
    const h = harness();
    await part(h);
    h.tick(400);
    h.beats[WORKER] = { open: false, atMs: T0 };
    expect((await wait(h, "--timeout", "5")).events).toEqual([{ kind: "suspect", agent: WORKER }]);
    await h.run(["hooks", "post-tool"], {
      tool_name: "TaskStop",
      tool_input: { task_id: WORKER },
      tool_response: { task_type: "local_agent" },
    });
    expect((await wait(h, "--timeout", "5")).events).toEqual([
      { kind: "ended", agent: WORKER, by: "task-stop" },
    ]);
  });

  it("prints the events and the next step in text mode", async () => {
    const h = harness();
    await part(h);
    await storeReport(h);
    const text = (await h.run(["agents", "wait", LEAD])).stdout;
    expect(text).toContain(`- report of ${WORKER} for ${TICKET}: status done`);
    expect(text).toContain("children: 0 starting, 1 running, 0 suspect, 0 ended");
    expect(text).toContain("Read each message and report, act on it, then dispatch or wait again.");
  });

  it("refuses a timeout out of range and an unknown agent", async () => {
    const h = harness();
    await part(h);
    for (const timeout of ["600", "0", "soon"]) {
      const result = await h.run(["agents", "wait", LEAD, "--timeout", timeout, "--json"]);
      expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
    }
    const missing = await h.run(["agents", "wait", "nobody", "--json"]);
    expect(missing.json).toMatchObject({ rule: "input/not-found" });
  });

  it("starts a child it has not seen start as starting", async () => {
    const h = harness();
    await part(h);
    await h.run(["hooks", "post-tool"], spawn(LEAD, SCOUT, "bdk:scout", "q"));
    expect((await wait(h, "--timeout", "1")).children).toMatchObject({ starting: 1, running: 1 });
    await h.run(["hooks", "subagent-start"], start(SCOUT, "bdk:scout"));
    expect((await wait(h, "--timeout", "1")).children).toMatchObject({ running: 2 });
  });
});
