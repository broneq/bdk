// The agent hooks of T41 through the registry on a memory repository
// (`kernel-cli/hooks`): the link and start, the stale end, the continuation
// check of both threads, and the agent guards of `pre-tool`. The E2E file
// `agents.e2e.ts` runs the same paths through the bundle.
import { describe, expect, it } from "vitest";

import { CHANGE, DIR, ROOT, writePackage } from "../../log/tests/support.ts";
import { agentsRegistryPath } from "../../shared/store/index.ts";
import { writeDesign, writeDesignVerdict, writePlanPart } from "../../graph/tests/support.ts";
import {
  postToolOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
} from "../schema/agents.ts";
import { endStaleAgents } from "../use-cases/lifecycle.ts";
import {
  agentStop,
  harness,
  LEAD,
  mainStop,
  openTicket,
  PACKAGE,
  SCOUT,
  SESSION,
  show,
  spawn,
  start,
  T0,
  TICKET,
  tree,
  WORKER,
} from "./agent-support.ts";
import type { Harness } from "./agent-support.ts";

describe("post-tool and subagent-start", () => {
  it("links the child with its package and hands it its identity", async () => {
    const h = harness();
    openTicket(h.store, TICKET, "02-3");
    writePackage(h.store, TICKET, "implementer", "02-3");
    const linked = await h.run(
      ["hooks", "post-tool", "--json"],
      spawn(LEAD, WORKER, "bdk:worker", `Read ${PACKAGE}.`),
    );
    expect(postToolOutput.parse(linked.json)).toStrictEqual({
      tool: "Agent",
      linked: { agent: WORKER, parent: LEAD, ticket: TICKET },
      ended: null,
    });
    const context = await h.run(["hooks", "subagent-start"], start(WORKER, "bdk:worker"));
    expect(context.stdout).toContain(`BDK-PACKAGE: ${PACKAGE}\\nBDK-TICKET: ${TICKET}`);
    const json = await h.run(["hooks", "subagent-start", "--json"], start(WORKER, "bdk:worker"));
    expect(subagentStartOutput.parse(json.json)).toMatchObject({ package: PACKAGE, parent: LEAD });
  });

  it("records nothing for other tools and unreadable payloads, and no context for other agents", async () => {
    const h = harness();
    for (const payload of [
      "not json",
      { tool_name: "Read", tool_input: {}, tool_response: {} },
      { tool_name: "TaskStop", tool_input: { task_id: "x" }, tool_response: { task_type: "bash" } },
      {
        tool_name: "TaskStop",
        tool_input: { task_id: "x" },
        tool_response: { task_type: "local_agent" },
      },
      { tool_name: "Agent", tool_input: {}, tool_response: {} },
    ]) {
      const result = await h.run(["hooks", "post-tool", "--json"], payload);
      expect(result.json).toMatchObject({ linked: null, ended: null });
    }
    expect((await h.run(["hooks", "subagent-start"], start(SCOUT, "Explore"))).stdout).toBe("");
    expect((await h.run(["hooks", "subagent-start"], "not json")).stdout).toBe("");
  });

  it("links a package the prompt names without a readable document by its path alone", async () => {
    const h = harness();
    const missing = `.bdk/changes/${CHANGE}/dispatch/02-9-implementer-A-9.md`;
    await h.run(["hooks", "post-tool"], spawn(LEAD, WORKER, "bdk:worker", `Read ${missing}.`));
    expect(await show(h, WORKER)).toMatchObject({ package: missing, ticket: null });
  });

  it("ends a foreground result and a TaskStop", async () => {
    const h = harness();
    await tree(h);
    await h.run(["hooks", "post-tool"], spawn(undefined, SCOUT, "bdk:runner", "run", "completed"));
    expect(await show(h, SCOUT)).toMatchObject({ state: "ended", endedBy: "agent-result" });
    await h.run(["hooks", "post-tool"], {
      session_id: SESSION,
      tool_name: "TaskStop",
      tool_input: { task_id: WORKER },
      tool_response: { task_type: "local_agent" },
    });
    expect(await show(h, WORKER)).toMatchObject({ state: "ended", endedBy: "task-stop" });
  });

  it("ends the silent agents of other sessions at session start", async () => {
    const h = harness();
    await tree(h);
    h.tick(3600);
    h.beats[LEAD] = { open: false, atMs: T0 + 3_590_000 };
    expect(
      await endStaleAgents(
        h.deps,
        { cwd: ROOT, workTree: ROOT, globalDir: "/home/dev/.config/bdk" },
        JSON.stringify({ session_id: "other" }),
      ),
    ).toEqual([WORKER]);
  });
});

describe("continuation check", () => {
  it("sends a worker back until its report is stored, then ends it", async () => {
    const h = harness();
    await tree(h);
    const blocked = await h.run(
      ["hooks", "subagent-stop", "--json"],
      agentStop(WORKER, "bdk:worker"),
    );
    expect(subagentStopOutput.parse(blocked.json)).toMatchObject({
      agent: WORKER,
      decision: "block",
      continuations: 1,
    });
    const text = await h.run(["hooks", "subagent-stop"], agentStop(WORKER, "bdk:worker"));
    expect(JSON.parse(text.stdout)).toMatchObject({ decision: "block" });
    h.store.write(`${DIR}/reports/02-3-implementer-${TICKET}.md`, "---\nstatus: done\n---\n");
    const passed = await h.run(["hooks", "subagent-stop"], agentStop(WORKER, "bdk:worker"));
    expect(passed.stdout).toBe("");
    expect(await show(h, WORKER)).toMatchObject({ state: "ended", endedBy: "subagent-stop" });
  });

  it("passes at the limit and writes the stall finding once", async () => {
    const h = harness("agents:\n  continuation:\n    max: 1\n");
    await tree(h);
    const stop = () => h.run(["hooks", "subagent-stop", "--json"], agentStop(WORKER, "bdk:worker"));
    expect((await stop()).json).toMatchObject({ decision: "block", continuations: 1 });
    const stalled = (await stop()).json as { decision: string; stalled?: string };
    expect(stalled.decision).toBe("pass");
    expect(stalled.stalled).toMatch(/^L-/);
    const findings = h.store.list(`${DIR}/log`).filter((name) => name.includes("-finding-"));
    expect(findings).toHaveLength(1);
  });

  it("lets an agent with running children and a non-BDK agent end", async () => {
    const h = harness();
    await tree(h);
    const withChild = await h.run(
      ["hooks", "subagent-stop", "--json"],
      agentStop(WORKER, "bdk:worker", [SCOUT]),
    );
    expect(withChild.json).toMatchObject({ decision: "pass" });
    const other = await h.run(["hooks", "subagent-stop", "--json"], agentStop(SCOUT, "Explore"));
    expect(other.json).toMatchObject({ agent: SCOUT, decision: "pass" });
    const unreadable = await h.run(["hooks", "subagent-stop", "--json"], "not json");
    expect(unreadable.json).toMatchObject({ agent: null, decision: "pass" });
  });

  it("sends a lead back while a task ticket of its part is open", async () => {
    const h = harness();
    openTicket(h.store, "A-00000002", "02", "part-lead");
    writePackage(h.store, "A-00000002", "implementer", "02");
    await tree(h);
    await h.run(
      ["hooks", "post-tool"],
      spawn(
        undefined,
        LEAD,
        "bdk:lead",
        `Read .bdk/changes/${CHANGE}/dispatch/02-implementer-A-00000002.md.`,
      ),
    );
    h.tick(42);
    const report = subagentStopOutput.parse(
      (await h.run(["hooks", "subagent-stop", "--json"], agentStop(LEAD, "bdk:lead"))).json,
    );
    expect(report.decision).toBe("block");
    expect(report.reason).toContain(`ticket ${TICKET} for 02-3 of part 02 is open`);
    expect(report.reason).toContain("elapsed 42s");
  });

  it("sends a lead back until its tasks are committed and its report is stored", async () => {
    const h = harness();
    const lead = "A-00000002";
    writePlanPart(h.store, "02", {
      body: "## 02-3 Verify the link\n\n**Files:**\n\n- Create: `src/verify.ts`\n\n**Verification:** none\n",
    });
    openTicket(h.store, lead, "02", "part-lead");
    writePackage(h.store, lead, "lead", "02");
    openTicket(h.store, TICKET, "02-3", "task-redispatch", true);
    await h.run(
      ["hooks", "post-tool"],
      spawn(
        undefined,
        LEAD,
        "bdk:lead",
        `Read .bdk/changes/${CHANGE}/dispatch/02-lead-${lead}.md.`,
      ),
    );
    await h.run(["hooks", "subagent-start"], start(LEAD, "bdk:lead"));
    const stop = async () =>
      subagentStopOutput.parse(
        (await h.run(["hooks", "subagent-stop", "--json"], agentStop(LEAD, "bdk:lead"))).json,
      );
    expect((await stop()).reason).toContain("task 02-3 of part 02 is not committed");
    const run = h.deps.git.run.bind(h.deps.git);
    h.deps.git.run = (args, cwd) =>
      args[0] === "log"
        ? Promise.resolve({
            code: 0,
            stdout: `c0ffee1\x1fp0\x1fverify\x1f${CHANGE}\x1f02\x1f02-3\x1e`,
            stderr: "",
          })
        : run(args, cwd);
    expect((await stop()).reason).toContain(`your report for ${lead} is not stored`);
    const envelope = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";
    expect((await h.run(["log", "ingest", "--ticket", lead, "--json"], envelope)).code).toBe(0);
    expect(await stop()).toMatchObject({ decision: "pass" });
  });

  it("sends the main thread back while its stage has a ready artifact", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"]);
    await h.run(["done", "architecture"]);
    writeDesignVerdict(h.store, new Date().toISOString());
    await h.run(["done", "design-verify"]);
    await h.run(["hooks", "prompt-expansion"], {
      session_id: SESSION,
      hook_event_name: "UserPromptExpansion",
      expansion_type: "slash_command",
      command_name: "bdk:plan",
      command_args: "",
      prompt: "/bdk:plan",
    });
    const blocked = stopOutput.parse((await h.run(["hooks", "stop", "--json"], mainStop())).json);
    expect(blocked).toMatchObject({ decision: "block", continuations: 1 });
    expect(blocked.reason).toMatch(/^BDK: plan\S* is (ready|stale) \(bdk next\)/);
    expect((await h.run(["hooks", "stop"], mainStop([LEAD]))).stdout).toBe("");
    await h.run(["log", "add", "question", "Which format?", "--ref", "plan", "--json"]);
    expect((await h.run(["hooks", "stop", "--json"], mainStop())).json).toMatchObject({
      decision: "pass",
    });
  });

  it("passes an ordinary conversation and an unreadable payload", async () => {
    const h = harness();
    expect((await h.run(["hooks", "stop", "--json"], mainStop())).json).toMatchObject({
      decision: "pass",
      continuations: 0,
    });
    expect((await h.run(["hooks", "stop"], "not json")).stdout).toBe("");
  });
});

describe("agent guards", () => {
  const preTool = (h: Harness, payload: Record<string, unknown>) =>
    h.run(["hooks", "pre-tool", "--json"], { session_id: SESSION, cwd: ROOT, ...payload });

  it("records an admitted message for the recipient's wait", async () => {
    const h = harness();
    await tree(h);
    const entry = (
      (await h.run(["log", "add", "finding", "token", "--ref", "src/a.ts", "--json"])).json as {
        entry: { id: string };
      }
    ).entry.id;
    const sent = await preTool(h, {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "SendMessage",
      tool_input: { to: LEAD, message: `${entry} changes the token` },
    });
    expect(sent.code).toBe(0);
    const waited = await h.run(["agents", "wait", LEAD, "--timeout", "1", "--json"]);
    expect(waited.json).toMatchObject({ events: [{ kind: "message", from: WORKER, entry }] });
    const toMain = await preTool(h, {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "SendMessage",
      tool_input: { to: "main", message: `${entry} changes the token` },
    });
    expect(toMain.code).toBe(0);
  });

  it("keeps a worker's edits inside the workdir of its package (T45)", async () => {
    const h = harness();
    const workdir = `${ROOT}/.bdk/.machine/worktrees/${CHANGE}/02`;
    openTicket(h.store, TICKET, "02-3");
    writePackage(h.store, TICKET, "implementer", "02-3", { workdir });
    await h.run(["hooks", "post-tool"], spawn(undefined, WORKER, "bdk:worker", `Read ${PACKAGE}.`));
    const edit = (agent: string | undefined, path: string, cwd = ROOT) =>
      preTool(h, {
        ...(agent === undefined ? {} : { agent_id: agent, agent_type: "bdk:worker" }),
        cwd,
        tool_name: "Edit",
        tool_input: { file_path: path, old_string: "a", new_string: "b" },
      });
    const outside = await edit(WORKER, `${ROOT}/src/api/http.ts`);
    expect(outside.code).toBe(2);
    expect(outside.json).toMatchObject({ rule: "guard/worktree-scope" });
    expect(JSON.stringify(outside.json)).toContain(workdir);
    expect((await edit(WORKER, `${workdir}/src/api/http.ts`)).code).toBe(0);
    expect((await edit(WORKER, "src/api/http.ts", workdir)).code).toBe(0);
    expect((await edit(WORKER, `${workdir}/../01/src/a.ts`)).code).toBe(2);
    expect((await edit(undefined, `${ROOT}/src/api/http.ts`)).code).toBe(0);
  });

  it("leaves a worker without workdir in its package to edit anywhere", async () => {
    const h = harness();
    await tree(h);
    const result = await preTool(h, {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "Write",
      tool_input: { file_path: `${ROOT}/src/api/http.ts`, content: "x" },
    });
    expect(result.code).toBe(0);
  });

  it("scopes a lead's verbs to the part of its package", async () => {
    const h = harness();
    openTicket(h.store, "A-00000002", "02", "part-lead");
    writePackage(h.store, "A-00000002", "implementer", "02");
    await h.run(
      ["hooks", "post-tool"],
      spawn(
        undefined,
        LEAD,
        "bdk:lead",
        `Read .bdk/changes/${CHANGE}/dispatch/02-implementer-A-00000002.md.`,
      ),
    );
    const bash = (command: string) =>
      preTool(h, {
        agent_id: LEAD,
        agent_type: "bdk:lead",
        tool_name: "Bash",
        tool_input: { command: `node /p/dist/bdk.mjs ${command}` },
      });
    expect((await bash("attempt open task-redispatch 02-3")).code).toBe(0);
    expect((await bash("attempt close A-00000002 ok")).code).toBe(0);
    expect((await bash("dispatch build 03-1 implementer A-1")).json).toMatchObject({
      rule: "guard/lead-scope",
    });
    const stranger = await preTool(h, {
      agent_id: SCOUT,
      agent_type: "bdk:lead",
      tool_name: "Bash",
      tool_input: { command: "node /p/dist/bdk.mjs commit 02-3" },
    });
    expect(stranger.json).toMatchObject({ rule: "guard/lead-scope" });
  });

  it("scopes a judge's triage to the entries of its registry package (#158)", async () => {
    const h = harness();
    const judgeTicket = "A-00000009";
    openTicket(h.store, judgeTicket, CHANGE, "review-fix");
    writePackage(h.store, judgeTicket, "judge", CHANGE, {
      adapter: "judge",
      entries: ["L-a1a1a1a1"],
    });
    const path = `.bdk/changes/${CHANGE}/dispatch/${CHANGE}-judge-${judgeTicket}.md`;
    await h.run(["hooks", "post-tool"], spawn(undefined, SCOUT, "bdk:judge", `Read ${path}.`));
    const bash = (command: string) =>
      preTool(h, {
        agent_id: SCOUT,
        agent_type: "bdk:judge",
        tool_name: "Bash",
        tool_input: { command: `node /p/dist/bdk.mjs ${command}` },
      });
    expect((await bash('log triage L-a1a1a1a1 should-fix --reason "holds"')).code).toBe(0);
    const outside = await bash('log triage L-z9z9z9z9 not-a-problem --reason "x"');
    expect(outside.json).toMatchObject({ rule: "guard/judge-scope" });
    expect(JSON.stringify(outside.json)).toContain("L-z9z9z9z9");
    expect((await bash('log resolve L-a1a1a1a1 resolved --reason "x"')).json).toMatchObject({
      rule: "guard/subagent-kernel-command",
    });
  });

  it("tells a lead started in the foreground why it has no part", async () => {
    const h = harness();
    await h.run(["hooks", "subagent-start"], start(LEAD, "bdk:lead"));
    const result = await preTool(h, {
      agent_id: LEAD,
      agent_type: "bdk:lead",
      tool_name: "Bash",
      tool_input: { command: "node /p/dist/bdk.mjs attempt open task-redispatch 02-3" },
    });
    expect(result.json).toMatchObject({ rule: "guard/lead-scope" });
    expect(JSON.stringify(result.json)).toContain("run_in_background: true");
  });

  it("decides on the default limits when the settings do not parse", async () => {
    const h = harness("agents: [broken\n");
    await tree(h);
    const result = await preTool(h, {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "Agent",
      tool_input: { subagent_type: "bdk:scout", prompt: "Where is the token parsed?" },
    });
    expect(result.code, result.stdout).toBe(0);
  });

  it("judges a message without a registry by the entry alone", async () => {
    const h = harness();
    h.store.remove(agentsRegistryPath(ROOT));
    const message = (text: string) =>
      preTool(h, {
        agent_id: WORKER,
        agent_type: "bdk:worker",
        tool_name: "SendMessage",
        tool_input: { to: "main", message: text },
      });
    expect((await message("the token format changes")).json).toMatchObject({
      rule: "guard/agent-message",
    });
    expect((await message("L-00000000 changes the token")).json).toMatchObject({
      rule: "guard/agent-message",
    });
  });

  it("lets a lead start workers and a main-thread agent start anything", async () => {
    const h = harness();
    await tree(h);
    const call = (caller: Record<string, unknown>, type: string) =>
      preTool(h, {
        ...caller,
        tool_name: "Agent",
        tool_input: { subagent_type: type, prompt: `Read ${PACKAGE}.` },
      });
    expect((await call({ agent_id: LEAD, agent_type: "bdk:lead" }, "bdk:worker")).code).toBe(0);
    expect((await call({ agent_id: LEAD, agent_type: "bdk:lead" }, "bdk:lead")).json).toMatchObject(
      {
        rule: "guard/agent-spawn",
      },
    );
    expect(
      (await call({ agent_id: SCOUT, agent_type: "bdk:reader" }, "bdk:scout")).json,
    ).toMatchObject({
      rule: "guard/agent-spawn",
    });
    expect((await call({ agent_id: SCOUT, agent_type: "Explore" }, "Explore")).code).toBe(0);
  });
});
