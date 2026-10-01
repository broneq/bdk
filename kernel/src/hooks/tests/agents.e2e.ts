// The agent hooks of T41 through the committed bundle (`kernel-cli/hooks`):
// the registry link and start in the recorded 2.1.284 shapes, the stale-row
// end of `session-start`, the continuation check of `stop` and
// `subagent-stop`, and the agent guards of `pre-tool`.
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk } from "../../../tests/support/repo.ts";
import { dispatched, opened, started as change } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import {
  heartbeat,
  hook,
  promptFor,
  SESSION,
  spawned,
  started,
} from "../../agents/tests/e2e-support.ts";

const LEAD = "a9f8e7d6c5b4a3f2e";
const WORKER = "a1b2c3d4e5f6a7b8c";
const SCOUT = "a5e4d3c2b1a0f9e8d";

function show(root: string, id: string) {
  return answered(bdk(["agents", "show", id, "--json"], root), "output/agents-show.json");
}

/** A worker of the lead on task 01-1 with its package, linked and started. */
function worker(settings = ""): { change: Started; ticket: string; path: string } {
  const started_ = change(settings);
  const ticket = opened(started_, "task-redispatch", "01-1");
  const path = dispatched(started_, ticket, "01-1");
  spawned(started_.root, { child: LEAD, type: "bdk:lead", prompt: "lead part 01" });
  started(started_.root, LEAD, "bdk:lead");
  spawned(started_.root, {
    parent: { id: LEAD, type: "bdk:lead" },
    child: WORKER,
    type: "bdk:worker",
    prompt: promptFor(path),
  });
  return { change: started_, ticket, path };
}

function agentStop(root: string, id: string, type: string, running: readonly string[] = []) {
  return bdk(["hooks", "subagent-stop", "--json"], root, {
    stdin: JSON.stringify({
      session_id: SESSION,
      cwd: root,
      agent_id: id,
      agent_type: type,
      hook_event_name: "SubagentStop",
      stop_hook_active: false,
      last_assistant_message: "done",
      background_tasks: [id, ...running].map((task) => ({
        id: task,
        type: "subagent",
        status: "running",
        description: "work",
      })),
    }),
  });
}

function mainStop(root: string, running: readonly string[] = [], json = true) {
  return bdk(["hooks", "stop", ...(json ? ["--json"] : [])], root, {
    stdin: JSON.stringify({
      session_id: SESSION,
      cwd: root,
      hook_event_name: "Stop",
      stop_hook_active: false,
      background_tasks: running.map((task) => ({
        id: task,
        type: "subagent",
        status: "running",
        description: "lead",
      })),
    }),
  });
}

function typedExecute(root: string): void {
  hook(root, "prompt-expansion", {
    session_id: SESSION,
    cwd: root,
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "bdk:execute",
    command_args: "",
    command_source: "plugin",
    prompt: "/bdk:execute",
  });
}

function preTool(root: string, payload: Record<string, unknown>) {
  return bdk(["hooks", "pre-tool", "--json"], root, {
    stdin: JSON.stringify({
      session_id: SESSION,
      cwd: root,
      hook_event_name: "PreToolUse",
      ...payload,
    }),
  });
}

function denied(result: ReturnType<typeof bdk>, rule: string): string {
  expect(result.code, result.stdout + result.stderr).toBe(2);
  const refusal = JSON.parse(result.stdout) as { rule: string; why: string };
  expect(refusal.rule).toBe(rule);
  return refusal.why;
}

function findings(root: string): { summary: string; review?: boolean; refs: string[] }[] {
  const listed = bdk(["log", "list", "--type", "finding", "--json"], root);
  return (listed.json as { items: { summary: string; review?: boolean; refs: string[] }[] }).items;
}

describe("bdk hooks subagent-start and post-tool", () => {
  it("gives a linked bdk: agent its identity lines", () => {
    const { change: started_, ticket, path } = worker();
    const stdout = started(started_.root, WORKER, "bdk:worker");
    const context = (JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;
    expect(context.split("\n")).toEqual([
      `BDK-AGENT-ID: ${WORKER}`,
      `BDK-PARENT: ${LEAD}`,
      `BDK-PACKAGE: ${path}`,
      `BDK-TICKET: ${ticket}`,
    ]);
    const json = answered(
      bdk(["hooks", "subagent-start", "--json"], started_.root, {
        stdin: JSON.stringify({ session_id: SESSION, agent_id: WORKER, agent_type: "bdk:worker" }),
      }),
      "output/hooks-subagent-start.json",
    );
    expect(json).toMatchObject({ agent: WORKER, parent: LEAD, package: path });
  });

  it("gives a foreground spawn its id only, and a non-BDK agent nothing", () => {
    const started_ = change();
    expect(started(started_.root, WORKER, "bdk:runner").trimEnd()).toBe(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SubagentStart",
          additionalContext: `BDK-AGENT-ID: ${WORKER}`,
        },
      }),
    );
    expect(started(started_.root, SCOUT, "Explore")).toBe("");
  });

  it("links at launch, ends a foreground result and a TaskStop", () => {
    const { change: started_, ticket } = worker();
    expect(show(started_.root, WORKER)).toMatchObject({ state: "starting", ticket, parent: LEAD });
    spawned(started_.root, {
      child: SCOUT,
      type: "bdk:runner",
      prompt: "run",
      status: "completed",
    });
    expect(show(started_.root, SCOUT)).toMatchObject({ state: "ended", endedBy: "agent-result" });
    const json = answered(
      bdk(["hooks", "post-tool", "--json"], started_.root, {
        stdin: JSON.stringify({
          session_id: SESSION,
          tool_name: "TaskStop",
          tool_input: { task_id: LEAD },
          tool_response: { task_id: LEAD, task_type: "local_agent" },
        }),
      }),
      "output/hooks-post-tool.json",
    );
    expect(json).toMatchObject({ ended: { agent: LEAD, by: "task-stop" } });
  });

  it("session-start ends a silent row of a crashed session", () => {
    const { change: started_ } = worker();
    started(started_.root, WORKER, "bdk:worker");
    heartbeat(started_.root, WORKER, false, 3600);
    const database = new DatabaseSync(join(started_.root, ".bdk/.machine/agents.sqlite"));
    const old = new Date(Date.now() - 3_600_000).toISOString();
    database
      .prepare("UPDATE agents SET started_at = ?, linked_at = ? WHERE id = ?")
      .run(old, old, WORKER);
    database.close();
    const result = bdk(["hooks", "session-start"], started_.root, {
      stdin: JSON.stringify({ session_id: "another-session", hook_event_name: "SessionStart" }),
    });
    expect(result.code).toBe(0);
    expect(show(started_.root, WORKER)).toMatchObject({ state: "ended", endedBy: "stale" });
    expect(show(started_.root, LEAD).state).toBe("running");
  });
});

describe("continuation check", () => {
  it("sends the main thread back while a stage artifact is ready", () => {
    const started_ = change();
    typedExecute(started_.root);
    const report = answered(mainStop(started_.root), "output/hooks-stop.json");
    expect(report).toMatchObject({ decision: "block", continuations: 1 });
    expect(report.reason).toMatch(/^BDK: execute-part:01 is ready \(bdk next\)\. Continue it;/);
    const text = mainStop(started_.root, [], false);
    expect(JSON.parse(text.stdout)).toMatchObject({ decision: "block" });
  });

  it("lets the turn end for an open question", () => {
    const started_ = change();
    typedExecute(started_.root);
    answered(
      bdk(
        ["log", "add", "question", "Which token format?", "--ref", "execute-part:01", "--json"],
        started_.root,
      ),
      "output/log-add.json",
    );
    const result = mainStop(started_.root, [], false);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("lets main wait for background leads", () => {
    const started_ = change();
    typedExecute(started_.root);
    expect(answered(mainStop(started_.root, [LEAD]), "output/hooks-stop.json").decision).toBe(
      "pass",
    );
  });

  it("passes an ordinary conversation", () => {
    const started_ = change();
    expect(mainStop(started_.root, [], false).stdout).toBe("");
  });

  it("never traps the user in a broken Change", () => {
    const started_ = change();
    typedExecute(started_.root);
    const bad = join(started_.dir, "log/20260930T100000Z-finding-L-zzzzzzzz.md");
    writeFileSync(bad, "---\nnot: valid\n---\n");
    const result = mainStop(started_.root, [], false);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("sends a worker back until its report is stored", () => {
    const { change: started_, ticket } = worker();
    started(started_.root, WORKER, "bdk:worker");
    const report = answered(
      agentStop(started_.root, WORKER, "bdk:worker"),
      "output/hooks-subagent-stop.json",
    );
    expect(report).toMatchObject({ agent: WORKER, decision: "block", continuations: 1 });
    expect(report.reason).toContain(`bdk log ingest --ticket ${ticket}`);
    expect(show(started_.root, WORKER).state).toBe("running");
    answered(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], started_.root, {
        stdin: "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n",
      }),
      "output/log-ingest.json",
    );
    const done = agentStop(started_.root, WORKER, "bdk:worker");
    expect(answered(done, "output/hooks-subagent-stop.json").decision).toBe("pass");
    expect(show(started_.root, WORKER)).toMatchObject({ state: "ended", endedBy: "subagent-stop" });
  });

  it("sends a lead back while a task of its part is left, naming elapsed", () => {
    const started_ = change();
    const root = started_.root;
    const lead = opened(started_, "part-lead", "01");
    spawned(root, {
      child: LEAD,
      type: "bdk:lead",
      prompt: promptFor(dispatched(started_, lead, "01", "lead")),
    });
    started(root, LEAD, "bdk:lead");
    const ticket = opened(started_, "task-redispatch", "01-1");
    const open = agentStop(root, LEAD, "bdk:lead");
    expect(open.code, open.stderr).toBe(0);
    expect(open.json).toMatchObject({ decision: "block" });
    expect((open.json as { reason: string }).reason).toMatch(
      new RegExp(`ticket ${ticket} for 01-1 of part 01 is open.*elapsed \\d+s`),
    );
    answered(
      bdk(["attempt", "close", ticket, "not-run", "--reason", "r", "--json"], root),
      "output/attempt-close.json",
    );
    const left = agentStop(root, LEAD, "bdk:lead");
    expect((left.json as { reason: string }).reason).toMatch(
      /task 01-1 of part 01 is not committed.*elapsed \d+s/,
    );
  });

  it("passes at the limit without progress and writes one finding", () => {
    const { change: started_, ticket } = worker("agents:\n  continuation:\n    max: 3\n");
    started(started_.root, WORKER, "bdk:worker");
    for (const count of [1, 2, 3]) {
      const report = answered(
        agentStop(started_.root, WORKER, "bdk:worker"),
        "output/hooks-subagent-stop.json",
      );
      expect(report).toMatchObject({ decision: "block", continuations: count });
    }
    const last = answered(
      agentStop(started_.root, WORKER, "bdk:worker"),
      "output/hooks-subagent-stop.json",
    );
    expect(last.decision).toBe("pass");
    expect(typeof last.stalled).toBe("string");
    const stalls = findings(started_.root).filter((entry) => entry.summary.startsWith("stopped"));
    expect(stalls).toHaveLength(1);
    expect(stalls[0]).toMatchObject({ review: true, refs: [ticket] });
    expect(show(started_.root, WORKER).state).toBe("ended");
  });

  it("passes a non-BDK subagent", () => {
    const started_ = change();
    started(started_.root, SCOUT, "Explore");
    expect(agentStop(started_.root, SCOUT, "Explore").json).toMatchObject({ decision: "pass" });
  });
});

describe("agent guards", () => {
  it("holds a lead's dispatch to the package prompt", () => {
    const started_ = change();
    const lead = (prompt: string) =>
      preTool(started_.root, {
        tool_name: "Agent",
        tool_input: { subagent_type: "bdk:lead", prompt, description: "lead" },
      });
    denied(lead("Run part 01.\n\nStart with the token parser."), "guard/dispatch-prompt");
    expect(lead(promptFor(".bdk/changes/c/dispatch/01-part-lead-A-1.md")).code).toBe(0);
  });

  it("decides on the default limits when the settings do not parse", () => {
    const { change: started_ } = worker();
    started(started_.root, WORKER, "bdk:worker");
    writeFileSync(join(started_.root, ".bdk/settings.yaml"), "agents: [broken\n");
    const result = preTool(started_.root, {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "Agent",
      tool_input: { subagent_type: "bdk:scout", prompt: "Where is the token parsed?" },
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
  });

  it("lets a worker start a scout, never a worker", () => {
    const { change: started_ } = worker("agents:\n  scout:\n    max-per-ticket: 1\n");
    started(started_.root, WORKER, "bdk:worker");
    const scout = {
      agent_id: WORKER,
      agent_type: "bdk:worker",
      tool_name: "Agent",
      tool_input: {
        subagent_type: "bdk:scout",
        prompt: "Where is the token parsed?",
        description: "s",
      },
    };
    expect(preTool(started_.root, scout).code).toBe(0);
    spawned(started_.root, {
      parent: { id: WORKER, type: "bdk:worker" },
      child: SCOUT,
      type: "bdk:scout",
      prompt: "Where is the token parsed?",
    });
    expect(denied(preTool(started_.root, scout), "guard/agent-spawn")).toContain(
      "agents.scout.max-per-ticket is 1",
    );
    expect(
      denied(
        preTool(started_.root, {
          ...scout,
          tool_input: {
            subagent_type: "bdk:worker",
            prompt: promptFor(".bdk/changes/c/dispatch/01-1-implementer-A-1.md"),
            description: "w",
          },
        }),
        "guard/agent-spawn",
      ),
    ).toContain("a bdk:worker may not start bdk:worker");
  });

  it("admits a message naming a ledger id to a running agent only", () => {
    const { change: started_ } = worker();
    started(started_.root, WORKER, "bdk:worker");
    const entry = (
      answered(
        bdk(
          ["log", "add", "finding", "token format changes", "--ref", "src/01-1.ts", "--json"],
          started_.root,
        ),
        "output/log-add.json",
      ).entry as { id: string }
    ).id;
    const message = (to: string, text: string) =>
      preTool(started_.root, {
        agent_id: WORKER,
        agent_type: "bdk:worker",
        tool_name: "SendMessage",
        tool_input: { to, message: text, summary: "s" },
      });
    expect(denied(message(LEAD, "the token format changes"), "guard/agent-message")).toContain(
      "bdk log add",
    );
    expect(denied(message(LEAD, `${entry} ${"x".repeat(400)}`), "guard/agent-message")).toContain(
      "agents.message.max-chars",
    );
    expect(denied(message(SCOUT, `${entry} matters`), "guard/agent-message")).toContain(
      "bdk agents list --affected-by",
    );
    expect(message(LEAD, `${entry} changes the token format`).code).toBe(0);
  });

  it("limits a lead's orchestrator verbs to its own part", () => {
    const started_ = change();
    const lead = opened(started_, "task-redispatch", "01-1");
    const path = dispatched(started_, lead, "01-1");
    spawned(started_.root, { child: LEAD, type: "bdk:lead", prompt: promptFor(path) });
    started(started_.root, LEAD, "bdk:lead");
    const bash = (command: string) =>
      preTool(started_.root, {
        agent_id: LEAD,
        agent_type: "bdk:lead",
        tool_name: "Bash",
        tool_input: { command: `node /p/dist/bdk.mjs ${command}` },
      });
    // The lead's target is task 01-1, so its part is 01-1 alone.
    expect(bash("dispatch build 01-1 implementer A-1").code).toBe(0);
    expect(denied(bash("dispatch build 02-1 implementer A-1"), "guard/lead-scope")).toContain(
      "02-1",
    );
    denied(bash("part done 01"), "guard/subagent-kernel-command");
    denied(
      preTool(started_.root, {
        agent_id: LEAD,
        agent_type: "bdk:lead",
        tool_name: "Bash",
        tool_input: { command: "echo x > notes.md" },
      }),
      "guard/reader-write",
    );
  });
});
