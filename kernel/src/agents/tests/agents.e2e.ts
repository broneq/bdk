// `bdk agents list|show|wait` through the built bundle
// (`kernel-cli/agents`): the registry fed by the agent hooks with the recorded
// 2.1.284 payload shapes, a real Change with dispatched tickets, and the
// heartbeat files the guard scripts write.
import { describe, expect, it } from "vitest";

import { answered, bdk, bdkAsync, refused, ingestArgs } from "../../../tests/support/repo.ts";
import { dispatched, opened, started as change } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import {
  backdate,
  heartbeat,
  promptFor,
  SESSION,
  spawned,
  started,
  stopped,
} from "./e2e-support.ts";

/** A non-BDK agent that starts the part agents itself, as a project's own orchestrator does. */
const PARENT = "a9f8e7d6c5b4a3f2e";
const PARENT_TYPE = "general-purpose";
const WORKER_A = "a1b2c3d4e5f6a7b8c";
const WORKER_B = "a7c6b5d4e3f2a1b0c";

interface Workers {
  readonly change: Started;
  readonly tickets: { readonly a: string; readonly b: string };
  readonly packages: { readonly a: string; readonly b: string };
}

/** Two part workers of the parent on parts 01 and 02, linked and started. */
function workers(settings = ""): Workers {
  const started_ = change(settings, { parallel: true });
  const a = opened(started_, "part", "01");
  const b = opened(started_, "part", "02");
  const packages = {
    a: dispatched(started_, a, "01"),
    b: dispatched(started_, b, "02"),
  };
  const root = started_.root;
  spawned(root, { child: PARENT, type: PARENT_TYPE, prompt: "run the parts" });
  started(root, PARENT, PARENT_TYPE);
  for (const [id, path] of [
    [WORKER_A, packages.a],
    [WORKER_B, packages.b],
  ] as const) {
    spawned(root, {
      parent: { id: PARENT, type: PARENT_TYPE },
      child: id,
      type: "bdk:worker",
      prompt: promptFor(path),
    });
    started(root, id, "bdk:worker");
  }
  return { change: started_, tickets: { a, b }, packages };
}

function list(root: string, ...flags: string[]) {
  return answered(bdk(["agents", "list", ...flags, "--json"], root), "output/agents-list.json")
    .agents as { id: string; state: string; parent: string | null; ticket: string | null }[];
}

function logEntry(root: string, ref: string): string {
  const result = bdk(
    ["log", "add", "finding", "token format changes", "--ref", ref, "--json"],
    root,
  );
  return (answered(result, "output/log-add.json").entry as { id: string }).id;
}

function ingest(root: string, ticket: string): void {
  answered(
    bdk(
      [
        ...ingestArgs(
          root,
          ticket,
          "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n",
        ),
        "--json",
      ],
      root,
    ),
    "output/log-ingest.json",
  );
}

describe("bdk agents list", () => {
  it("example run: the registry rows validate against agents-list.json", () => {
    const { change: started_, tickets } = workers();
    const agents = list(started_.root);
    expect(agents.map((agent) => agent.id)).toEqual([PARENT, WORKER_A, WORKER_B]);
    expect(agents[1]).toMatchObject({ state: "running", parent: PARENT, ticket: tickets.a });
  });

  it("affected by a file ref: only the worker whose Files: the entry names", () => {
    const { change: started_ } = workers();
    const entry = logEntry(started_.root, "src/02-1.ts");
    expect(list(started_.root, "--affected-by", entry).map((agent) => agent.id)).toEqual([
      WORKER_B,
    ]);
  });

  it("affected by a part ref: the worker of the part", () => {
    const { change: started_, tickets } = workers();
    const root = started_.root;
    expect(list(root, "--affected-by", logEntry(root, "01")).map((agent) => agent.id)).toEqual([
      WORKER_A,
    ]);
    expect(list(root)[1]).toMatchObject({ id: WORKER_A, ticket: tickets.a });
  });

  it("suspect without a hook: an old heartbeat and no open call", () => {
    const { change: started_ } = workers();
    backdate(started_.root, WORKER_A, 400);
    heartbeat(started_.root, WORKER_A, false, 400);
    const agents = list(started_.root, "--state", "suspect");
    expect(agents.map((agent) => agent.id)).toEqual([WORKER_A]);
  });

  it("ended agents are hidden by default", () => {
    const { change: started_ } = workers();
    stopped(started_.root, WORKER_A);
    expect(list(started_.root, "--children-of", PARENT).map((agent) => agent.id)).toEqual([
      WORKER_B,
    ]);
    expect(list(started_.root, "--children-of", PARENT, "--all")).toHaveLength(2);
  });

  it("input/not-found: an entry the Change does not hold", () => {
    const { change: started_ } = workers();
    refused(
      bdk(["agents", "list", "--affected-by", "L-00000000", "--json"], started_.root),
      3,
      "input/not-found",
    );
  });

  it("lists nothing in a project without a registry", () => {
    const started_ = change();
    expect(list(started_.root)).toEqual([]);
  });
});

describe("bdk agents show", () => {
  it("example run and the end by TaskStop", () => {
    const { change: started_ } = workers();
    const parent = answered(
      bdk(["agents", "show", PARENT, "--json"], started_.root),
      "output/agents-show.json",
    );
    expect(parent).toMatchObject({ id: PARENT, parent: "main", session: SESSION });
    expect((parent.children as unknown[]).length).toBe(2);
    stopped(started_.root, WORKER_A);
    expect(
      answered(
        bdk(["agents", "show", WORKER_A, "--json"], started_.root),
        "output/agents-show.json",
      ),
    ).toMatchObject({ state: "ended", endedBy: "task-stop" });
  });

  it("input/not-found", () => {
    const { change: started_ } = workers();
    refused(bdk(["agents", "show", "nobody", "--json"], started_.root), 3, "input/not-found");
  });
});

describe("bdk agents wait", () => {
  it("returns on a stored report, and never twice", async () => {
    const { change: started_, tickets } = workers();
    const waiting = bdkAsync(
      ["agents", "wait", PARENT, "--timeout", "20", "--json"],
      started_.root,
    );
    await new Promise((done) => setTimeout(done, 1500));
    const at = Date.now();
    ingest(started_.root, tickets.a);
    const result = await waiting;
    expect(Date.now() - at).toBeLessThan(3000);
    const report = answered(result, "output/agents-wait.json");
    expect(report.events).toEqual([
      { kind: "report", agent: WORKER_A, ticket: tickets.a, status: "done" },
    ]);
    expect(report.children).toEqual({ starting: 0, running: 2, suspect: 0, ended: 0 });
    const again = answered(
      bdk(["agents", "wait", PARENT, "--timeout", "1", "--json"], started_.root),
      "output/agents-wait.json",
    );
    expect(again.events).toEqual([{ kind: "timeout" }]);
  });

  it("returns an event stored between two waits at once", () => {
    const { change: started_, tickets } = workers();
    ingest(started_.root, tickets.b);
    const at = Date.now();
    const report = answered(
      bdk(["agents", "wait", PARENT, "--json"], started_.root),
      "output/agents-wait.json",
    );
    expect(Date.now() - at).toBeLessThan(2000);
    expect(report.events).toEqual([
      { kind: "report", agent: WORKER_B, ticket: tickets.b, status: "done" },
    ]);
  });

  it("returns on an admitted message", async () => {
    const { change: started_ } = workers();
    const entry = logEntry(started_.root, "src/01-1.ts");
    const waiting = bdkAsync(
      ["agents", "wait", PARENT, "--timeout", "20", "--json"],
      started_.root,
    );
    await new Promise((done) => setTimeout(done, 1000));
    const admitted = bdk(["hooks", "pre-tool"], started_.root, {
      stdin: JSON.stringify({
        session_id: SESSION,
        cwd: started_.root,
        hook_event_name: "PreToolUse",
        agent_id: WORKER_A,
        agent_type: "bdk:worker",
        tool_name: "SendMessage",
        tool_input: { to: PARENT, message: `${entry} changes the token format`, summary: "token" },
      }),
    });
    expect(admitted.code, admitted.stderr).toBe(0);
    const report = answered(await waiting, "output/agents-wait.json");
    expect(report.events).toEqual([{ kind: "message", from: WORKER_A, entry }]);
  });

  it("returns a child cut off without a signal as suspect", () => {
    const { change: started_ } = workers();
    backdate(started_.root, WORKER_A, 400);
    heartbeat(started_.root, WORKER_A, false, 400);
    const report = answered(
      bdk(["agents", "wait", PARENT, "--timeout", "2", "--json"], started_.root),
      "output/agents-wait.json",
    );
    expect(report.events).toEqual([{ kind: "suspect", agent: WORKER_A }]);
  });

  it("returns a child that ended without a report", () => {
    const { change: started_ } = workers();
    stopped(started_.root, WORKER_B);
    const report = answered(
      bdk(["agents", "wait", PARENT, "--timeout", "2", "--json"], started_.root),
      "output/agents-wait.json",
    );
    expect(report.events).toEqual([{ kind: "ended", agent: WORKER_B, by: "task-stop" }]);
  });

  it("times out with elapsed", () => {
    const { change: started_ } = workers();
    const at = Date.now();
    const report = answered(
      bdk(["agents", "wait", PARENT, "--timeout", "2", "--json"], started_.root),
      "output/agents-wait.json",
    );
    expect(Date.now() - at).toBeGreaterThanOrEqual(1900);
    expect(report.events).toEqual([{ kind: "timeout" }]);
    expect(report.elapsed).toBeGreaterThanOrEqual(2);
  });

  it("refuses a timeout above 540", () => {
    const { change: started_ } = workers();
    const refusal = refused(
      bdk(["agents", "wait", PARENT, "--timeout", "600", "--json"], started_.root),
      3,
      "input/invalid-argument",
    );
    expect(refusal.why).toContain("540");
  });

  it("input/not-found", () => {
    const { change: started_ } = workers();
    refused(bdk(["agents", "wait", "nobody", "--json"], started_.root), 3, "input/not-found");
  });

  it("prints one line per event and the next step in text mode", () => {
    const { change: started_, tickets } = workers();
    ingest(started_.root, tickets.a);
    const result = bdk(["agents", "wait", PARENT], started_.root);
    expect(result.stdout).toContain(`- report of ${WORKER_A} for ${tickets.a}: status done`);
    expect(result.stdout).toContain(
      "Read each message and report, act on it, then dispatch or wait again.",
    );
  });
});
