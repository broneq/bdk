// The agent hooks of T41 through the built bundle (`kernel-cli/hooks`):
// the registry link and start in the recorded 2.1.284 shapes, the stale-row
// end of `session-start`, the continuation check of `stop` and
// `subagent-stop`, and the agent guards of `pre-tool`.
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, ingestArgs } from "../../../tests/support/repo.ts";
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

const WORKER = "a1b2c3d4e5f6a7b8c";
const SCOUT = "a5e4d3c2b1a0f9e8d";

function show(root: string, id: string) {
  return answered(bdk(["agents", "show", id, "--json"], root), "output/agents-show.json");
}

/** The part agent `main` started on part 01 with its package, linked. */
function worker(settings = ""): { change: Started; ticket: string; path: string } {
  const started_ = change(settings);
  const ticket = opened(started_, "part", "01");
  const path = dispatched(started_, ticket, "01");
  spawned(started_.root, {
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
        description: "part 01",
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
      "BDK-PARENT: main",
      `BDK-PACKAGE: ${path}`,
      `BDK-TICKET: ${ticket}`,
    ]);
    const json = answered(
      bdk(["hooks", "subagent-start", "--json"], started_.root, {
        stdin: JSON.stringify({ session_id: SESSION, agent_id: WORKER, agent_type: "bdk:worker" }),
      }),
      "output/hooks-subagent-start.json",
    );
    expect(json).toMatchObject({ agent: WORKER, parent: "main", package: path });
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
    expect(show(started_.root, WORKER)).toMatchObject({
      state: "starting",
      ticket,
      parent: "main",
    });
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
          tool_input: { task_id: WORKER },
          tool_response: { task_id: WORKER, task_type: "local_agent" },
        }),
      }),
      "output/hooks-post-tool.json",
    );
    expect(json).toMatchObject({ ended: { agent: WORKER, by: "task-stop" } });
  });

  it("session-start ends a silent row of a crashed session", () => {
    const { change: started_ } = worker();
    started(started_.root, WORKER, "bdk:worker");
    spawned(started_.root, {
      parent: { id: WORKER, type: "bdk:worker" },
      child: SCOUT,
      type: "bdk:scout",
      prompt: "Where is the token parsed?",
    });
    started(started_.root, SCOUT, "bdk:scout");
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
    expect(show(started_.root, SCOUT).state).toBe("running");
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

  it("lets main wait for background part agents", () => {
    const started_ = change();
    typedExecute(started_.root);
    expect(answered(mainStop(started_.root, [WORKER]), "output/hooks-stop.json").decision).toBe(
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
      bdk(
        [
          ...ingestArgs(
            started_.root,
            ticket,
            "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n",
          ),
          "--json",
        ],
        started_.root,
      ),
      "output/log-ingest.json",
    );
    const done = agentStop(started_.root, WORKER, "bdk:worker");
    expect(answered(done, "output/hooks-subagent-stop.json").decision).toBe("pass");
    expect(show(started_.root, WORKER)).toMatchObject({ state: "ended", endedBy: "subagent-stop" });
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
  it("holds a part agent's dispatch to the package prompt", () => {
    const started_ = change();
    const part = (prompt: string) =>
      preTool(started_.root, {
        tool_name: "Agent",
        tool_input: { subagent_type: "bdk:worker", prompt, description: "part 01" },
      });
    denied(part("Run part 01.\n\nStart with the token parser."), "guard/dispatch-prompt");
    expect(part(promptFor(".bdk/changes/c/dispatch/01-implementer-A-1.md")).code).toBe(0);
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
            prompt: promptFor(".bdk/changes/c/dispatch/02-implementer-A-1.md"),
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
    expect(denied(message("main", "the token format changes"), "guard/agent-message")).toContain(
      "the message names no ledger entry of the active Change; a message between agents must name one",
    );
    expect(denied(message("main", `${entry} ${"x".repeat(400)}`), "guard/agent-message")).toContain(
      "agents.message.max-chars",
    );
    expect(denied(message(SCOUT, `${entry} matters`), "guard/agent-message")).toContain(
      "bdk agents list --affected-by",
    );
    expect(message("main", `${entry} changes the token format`).code).toBe(0);
  });

  it("lets a part agent run its checks, never an orchestrator verb", () => {
    const { change: started_, ticket } = worker();
    started(started_.root, WORKER, "bdk:worker");
    const bash = (type: string, command: string) =>
      preTool(started_.root, {
        agent_id: WORKER,
        agent_type: type,
        tool_name: "Bash",
        tool_input: { command },
      });
    expect(bash("bdk:worker", `node /p/dist/bdk.mjs check run 01-1 --ticket ${ticket}`).code).toBe(
      0,
    );
    denied(
      bash("bdk:worker", "node /p/dist/bdk.mjs part done 01"),
      "guard/subagent-kernel-command",
    );
    denied(bash("bdk:reviewer", "echo x > notes.md"), "guard/reader-write");
  });
});
