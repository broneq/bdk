// Acceptance of the agent tree (T41, one agent per part since #166) through
// the built bundle, driven by the recorded 2.1.284 hook payload shapes: `main`
// runs two parts through two background part agents, an entry of one reaches
// the other through an admitted message, each part agent checks and commits
// its tasks with the command `bdk check run` prints, the continuation check
// holds an agent whose report is not stored, `main` runs the conform and the
// part checks, and `part done` passes for both parts.
import { describe, expect, it } from "vitest";

import { answered, bdk, ingestArgs } from "../../../tests/support/repo.ts";
import {
  checkedIn,
  conformed,
  dispatched,
  opened,
  started as change,
} from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";
import { backdate, heartbeat, promptFor, SESSION, spawned, started } from "./e2e-support.ts";

const WORKER_A = "a00000000000a0011";
const WORKER_B = "a00000000000b0011";

const REPORT = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";

/** `main` starts the implementer of part `nn` in the background on its part ticket. */
function partAgent(change: Started, nn: string, id: string): string {
  const ticket = opened(change, "part", nn);
  spawned(change.root, {
    child: id,
    type: "bdk:worker",
    prompt: promptFor(dispatched(change, ticket, nn)),
  });
  started(change.root, id, "bdk:worker");
  return ticket;
}

/** A part agent's work: each task's file, checked and committed. */
function work(change: Started, ticket: string, tasks: readonly string[]): void {
  for (const task of tasks) {
    fileStore().write(`${change.root}/src/${task}.ts`, `export const task = "${task}";\n`);
    checkedIn(change, ticket, task);
  }
}

function subagentStop(change: Started, id: string) {
  const result = bdk(["hooks", "subagent-stop", "--json"], change.root, {
    stdin: JSON.stringify({
      session_id: SESSION,
      cwd: change.root,
      agent_id: id,
      agent_type: "bdk:worker",
      hook_event_name: "SubagentStop",
      stop_hook_active: false,
      background_tasks: [{ id, type: "subagent", status: "running" }],
    }),
  });
  expect(result.code, result.stderr).toBe(0);
  return result.json as { decision: string; reason?: string };
}

// Two parts through two agents spawn dozens of kernel and git processes: over
// the 30 s project default when the whole E2E suite loads the machine.
describe("the agent tree", { timeout: 120_000 }, () => {
  it("runs two parts through two part agents to part done", () => {
    const started_ = change("", { parallel: true });
    const root = started_.root;
    const tickets = {
      a: partAgent(started_, "01", WORKER_A),
      b: partAgent(started_, "02", WORKER_B),
    };

    // An entry of one part agent reaches the agent whose files it names, through an admitted message.
    const entry = (
      answered(
        bdk(
          [
            "log",
            "add",
            "finding",
            "shared token format",
            "--ref",
            "src/02-1.ts",
            "--ticket",
            tickets.a,
            "--json",
          ],
          root,
        ),
        "output/log-add.json",
      ).entry as { id: string }
    ).id;
    const affected = answered(
      bdk(["agents", "list", "--affected-by", entry, "--json"], root),
      "output/agents-list.json",
    ).agents as { id: string }[];
    expect(affected.map((agent) => agent.id)).toEqual([WORKER_B]);
    const message = bdk(["hooks", "pre-tool"], root, {
      stdin: JSON.stringify({
        session_id: SESSION,
        cwd: root,
        hook_event_name: "PreToolUse",
        agent_id: WORKER_A,
        agent_type: "bdk:worker",
        tool_name: "SendMessage",
        tool_input: { to: WORKER_B, message: `${entry} changes the token format`, summary: "t" },
      }),
    });
    expect(message.code, message.stdout + message.stderr).toBe(0);
    expect(
      answered(
        bdk(["agents", "wait", WORKER_B, "--timeout", "5", "--json"], root),
        "output/agents-wait.json",
      ).events,
    ).toEqual([{ kind: "message", from: WORKER_A, entry }]);

    // Each part agent commits its tasks; one that ends its turn without its report is sent back.
    work(started_, tickets.a, ["01-1", "01-2"]);
    work(started_, tickets.b, ["02-1"]);
    for (const [id, ticket] of [
      [WORKER_A, tickets.a],
      [WORKER_B, tickets.b],
    ] as const) {
      expect(subagentStop(started_, id).reason).toMatch(/your report for .* is not stored/);
      answered(
        bdk([...ingestArgs(root, ticket, REPORT), "--json"], root),
        "output/log-ingest.json",
      );
      expect(subagentStop(started_, id)).toMatchObject({ decision: "pass" });
    }

    // `main` runs the conform and the part checks, closes each ticket and the parts.
    for (const [nn, ticket] of [
      ["01", tickets.a],
      ["02", tickets.b],
    ] as const) {
      conformed(started_, ticket, nn);
      checkedIn(started_, ticket, nn);
      const closed = answered(
        bdk(["attempt", "close", ticket, "ok", "--json"], root),
        "output/attempt-close.json",
      );
      expect(closed.next).toStrictEqual({ action: "part-done" });
    }
    for (const nn of ["01", "02"]) {
      answered(bdk(["part", "done", nn, "--json"], root), "output/part-done.json");
    }
  });

  it("lists a part agent cut off without a signal as suspect", () => {
    const started_ = change("", { parallel: true });
    partAgent(started_, "01", WORKER_A);
    backdate(started_.root, WORKER_A, 400);
    heartbeat(started_.root, WORKER_A, false, 400);
    const agents = answered(
      bdk(["agents", "list", "--state", "suspect", "--json"], started_.root),
      "output/agents-list.json",
    ).agents as { id: string }[];
    expect(agents.map((agent) => agent.id)).toEqual([WORKER_A]);
  });
});
