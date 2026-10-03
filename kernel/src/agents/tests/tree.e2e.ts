// Acceptance of the agent tree (T41-D1 to D12) through the built bundle,
// driven by the recorded 2.1.284 hook payload shapes: `main` runs two parts
// through two background leads, each lead dispatches its workers, a worker's
// entry reaches its sibling, `agents wait` returns the reports, the leads
// close and commit at the same moment, the continuation check holds a lead
// with work left, and `part done` passes for both parts.
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, bdkAsync, repository } from "../../../tests/support/repo.ts";
import { dispatched, opened, stepsDone } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";
import { backdate, heartbeat, promptFor, SESSION, spawned, started } from "./e2e-support.ts";

const LEAD_A = "a0000000000000a01";
const LEAD_B = "a0000000000000b01";
const WORKER_A1 = "a00000000000a0011";
const WORKER_A2 = "a00000000000a0012";
const WORKER_B1 = "a00000000000b0011";

const REPORT = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";

/** A tiny Change with two independent parts, both started: 01 (01-1, 01-2) and 02 (02-1). */
function twoParts(): Started {
  const root = repository();
  const result = bdk(
    ["change", "new", "Reject expired links", "--profile", "tiny", "--reason", "r", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const part = (nn: string, ids: readonly string[]) => {
    const body = ids
      .map(
        (task) =>
          `## ${task} Task ${task}\n\n**Files:**\n\n- \`src/${task}.ts\`\n\n**Verification:** none\n`,
      )
      .join("\n");
    fileStore().write(
      join(dir, `plan/parts/${nn}-part.md`),
      `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n${body}`,
    );
  };
  part("01", ["01-1", "01-2"]);
  part("02", ["02-1"]);
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  for (const nn of ["01", "02"]) {
    answered(bdk(["part", "start", nn, "--json"], root), "output/part-start.json");
  }
  return { root, dir, id };
}

/** `main` starts the lead of part `nn` in the background on its part-lead ticket. */
function lead(change: Started, nn: string, id: string): string {
  const ticket = opened(change, "part-lead", nn);
  spawned(change.root, {
    child: id,
    type: "bdk:lead",
    prompt: promptFor(dispatched(change, ticket, nn, "lead")),
  });
  started(change.root, id, "bdk:lead");
  return ticket;
}

/** A lead dispatches the implementer of `task` to a background worker. */
function worker(change: Started, leadId: string, task: string, id: string): string {
  const ticket = opened(change, "task-redispatch", task);
  spawned(change.root, {
    parent: { id: leadId, type: "bdk:lead" },
    child: id,
    type: "bdk:worker",
    prompt: promptFor(dispatched(change, ticket, task)),
  });
  started(change.root, id, "bdk:worker");
  return ticket;
}

/** A worker's work: its file, then its report through ingest. */
function work(change: Started, task: string, ticket: string): void {
  fileStore().write(join(change.root, `src/${task}.ts`), `export const task = "${task}";\n`);
  answered(
    bdk(["log", "ingest", "--ticket", ticket, "--json"], change.root, { stdin: REPORT }),
    "output/log-ingest.json",
  );
}

function wait(change: Started, id: string) {
  return answered(
    bdk(["agents", "wait", id, "--timeout", "5", "--json"], change.root),
    "output/agents-wait.json",
  );
}

function subagentStop(change: Started, id: string, running: readonly string[] = []) {
  const result = bdk(["hooks", "subagent-stop", "--json"], change.root, {
    stdin: JSON.stringify({
      session_id: SESSION,
      cwd: change.root,
      agent_id: id,
      agent_type: "bdk:lead",
      hook_event_name: "SubagentStop",
      stop_hook_active: false,
      background_tasks: [id, ...running].map((task) => ({
        id: task,
        type: "subagent",
        status: "running",
      })),
    }),
  });
  expect(result.code, result.stderr).toBe(0);
  return result.json as { decision: string; reason?: string };
}

describe("the agent tree", () => {
  it("runs two parts through two leads to part done", async () => {
    const change = twoParts();
    const root = change.root;
    const leads = { a: lead(change, "01", LEAD_A), b: lead(change, "02", LEAD_B) };
    const tickets = {
      a1: worker(change, LEAD_A, "01-1", WORKER_A1),
      a2: worker(change, LEAD_A, "01-2", WORKER_A2),
      b1: worker(change, LEAD_B, "02-1", WORKER_B1),
    };

    // A worker's entry reaches the sibling whose files it names, through an admitted message.
    const entry = (
      answered(
        bdk(
          [
            "log",
            "add",
            "finding",
            "shared token format",
            "--ref",
            "src/01-2.ts",
            "--ticket",
            tickets.a1,
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
    expect(affected.map((agent) => agent.id).filter((id) => id !== WORKER_A1)).toEqual([
      LEAD_A,
      WORKER_A2,
    ]);
    const message = bdk(["hooks", "pre-tool"], root, {
      stdin: JSON.stringify({
        session_id: SESSION,
        cwd: root,
        hook_event_name: "PreToolUse",
        agent_id: WORKER_A1,
        agent_type: "bdk:worker",
        tool_name: "SendMessage",
        tool_input: { to: WORKER_A2, message: `${entry} changes the token format`, summary: "t" },
      }),
    });
    expect(message.code, message.stdout + message.stderr).toBe(0);
    expect(wait(change, WORKER_A2).events).toEqual([{ kind: "message", from: WORKER_A1, entry }]);

    // The workers report; each lead's wait returns its own children's reports.
    work(change, "01-1", tickets.a1);
    work(change, "01-2", tickets.a2);
    work(change, "02-1", tickets.b1);
    const reports = (id: string) =>
      (wait(change, id).events as { kind: string; agent: string }[])
        .filter((event) => event.kind === "report")
        .map((event) => event.agent)
        .sort();
    expect(reports(LEAD_A)).toEqual([WORKER_A1, WORKER_A2].sort());
    expect(reports(LEAD_B)).toEqual([WORKER_B1]);

    // A lead that ends its turn with a task ticket open is sent back.
    expect(subagentStop(change, LEAD_A)).toMatchObject({ decision: "block" });

    // Each lead closes its tickets; the leads commit at the same moment.
    for (const [task, ticket] of [
      ["01-1", tickets.a1],
      ["01-2", tickets.a2],
      ["02-1", tickets.b1],
    ] as const) {
      stepsDone(change, ticket, task);
      const closed = answered(
        bdk(["attempt", "close", ticket, "ok", "--json"], root),
        "output/attempt-close.json",
      );
      expect(closed.next).toStrictEqual({ action: "commit" });
    }
    const commits = await Promise.all(
      ["01-1", "02-1"].map((task) => bdkAsync(["commit", task, "--json"], root)),
    );
    for (const result of commits) expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(subagentStop(change, LEAD_A).reason).toMatch(/task 01-2 of part 01 is not committed/);
    answered(bdk(["commit", "01-2", "--json"], root), "output/commit.json");

    // Each lead stores its report and may end; main closes the lead tickets and the parts.
    for (const [id, ticket] of [
      [LEAD_A, leads.a],
      [LEAD_B, leads.b],
    ] as const) {
      expect(subagentStop(change, id).reason).toMatch(/your report for .* is not stored/);
      answered(
        bdk(["log", "ingest", "--ticket", ticket, "--json"], root, { stdin: REPORT }),
        "output/log-ingest.json",
      );
      expect(subagentStop(change, id)).toMatchObject({ decision: "pass" });
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

  it("returns a worker cut off without a signal to its lead's wait", () => {
    const change = twoParts();
    lead(change, "01", LEAD_A);
    worker(change, LEAD_A, "01-1", WORKER_A1);
    backdate(change.root, WORKER_A1, 400);
    heartbeat(change.root, WORKER_A1, false, 400);
    expect(wait(change, LEAD_A).events).toEqual([{ kind: "suspect", agent: WORKER_A1 }]);
  });
});
