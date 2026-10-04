// Agent lifecycle payloads in the recorded 2.1.284 shapes
// (`tests/fixtures/host-payloads/2.1.284/`), fed to the agent hooks through the
// built bundle, plus the two things a test cannot wait for: the heartbeat
// file the guard scripts write, and time passing.
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";

import { bdk } from "../../../tests/support/repo.ts";

export const SESSION = "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11";

function common(root: string) {
  return {
    session_id: SESSION,
    transcript_path: `/home/u/.claude/projects/p/${SESSION}.jsonl`,
    cwd: root,
    prompt_id: "p-1",
    permission_mode: "default",
  };
}

export interface Spawn {
  /** The spawning agent; absent for the main thread. */
  readonly parent?: { readonly id: string; readonly type: string };
  readonly child: string;
  readonly type: string;
  readonly prompt: string;
  /** `async_launched` for a background spawn, `completed` for a foreground result. */
  readonly status?: "async_launched" | "completed";
}

/** The parent's `PostToolUse` on `Agent` (HOST-FACTS `agent-link`). */
export function spawned(root: string, spawn: Spawn): void {
  const status = spawn.status ?? "async_launched";
  const input = {
    description: "work",
    prompt: spawn.prompt,
    subagent_type: spawn.type,
    ...(status === "async_launched" ? { run_in_background: true } : {}),
  };
  const payload = {
    ...common(root),
    ...(spawn.parent === undefined
      ? {}
      : { agent_id: spawn.parent.id, agent_type: spawn.parent.type }),
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_input: input,
    tool_response:
      status === "async_launched"
        ? { isAsync: true, status, agentId: spawn.child, description: "work", prompt: spawn.prompt }
        : { status, agentId: spawn.child, agentType: spawn.type, content: [], totalDurationMs: 10 },
    tool_use_id: `tu-${spawn.child}`,
    duration_ms: 5,
  };
  hook(root, "post-tool", payload);
}

/** The child's `SubagentStart`; returns the hook's stdout. */
export function started(root: string, id: string, type: string): string {
  return hook(root, "subagent-start", {
    session_id: SESSION,
    transcript_path: `/home/u/.claude/projects/p/${SESSION}.jsonl`,
    cwd: root,
    prompt_id: "p-1",
    agent_id: id,
    agent_type: type,
    hook_event_name: "SubagentStart",
  });
}

/** `PostToolUse` on `TaskStop` from the main thread (HOST-FACTS `stop-on-taskstop`). */
export function stopped(root: string, id: string): void {
  hook(root, "post-tool", {
    ...common(root),
    hook_event_name: "PostToolUse",
    tool_name: "TaskStop",
    tool_input: { task_id: id },
    tool_response: { message: "stopped", task_id: id, task_type: "local_agent" },
    tool_use_id: `tu-stop-${id}`,
    duration_ms: 2,
  });
}

export function hook(root: string, verb: string, payload: unknown): string {
  const result = bdk(["hooks", verb], root, { stdin: JSON.stringify(payload) });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  return result.stdout;
}

/** The heartbeat the guard scripts write, `seconds` ago. */
export function heartbeat(root: string, id: string, open: boolean, seconds = 0): void {
  const dir = join(root, ".bdk", ".machine", "agents");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, id);
  writeFileSync(path, open ? "open" : "idle");
  const at = new Date(Date.now() - seconds * 1000);
  utimesSync(path, at, at);
}

/** Moves the agent's recorded start and link `seconds` into the past. */
export function backdate(root: string, id: string, seconds: number): void {
  const database = new DatabaseSync(join(root, ".bdk", ".machine", "agents.sqlite"));
  try {
    const at = new Date(Date.now() - seconds * 1000).toISOString();
    database
      .prepare(
        "UPDATE agents SET started_at = CASE WHEN started_at IS NULL THEN NULL ELSE ? END, linked_at = CASE WHEN linked_at IS NULL THEN NULL ELSE ? END WHERE id = ?",
      )
      .run(at, at, id);
  } finally {
    database.close();
  }
}

/** The one-line prompt a dispatching agent passes: the package path. */
export function promptFor(packagePath: string): string {
  return `Read ${packagePath} and work on it.`;
}
