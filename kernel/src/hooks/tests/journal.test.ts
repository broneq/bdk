// The run journal and verbose lines of the hooks on a memory repository
// (`kernel-cli/hooks`, Run journal and verbose lines): the session, agent and
// question lines, the live line with and without the verbose marker, and the
// session-end render. The marker itself is in session-start.test.ts, the
// bundle and the shell side in hooks.e2e.ts.
import lifecycle from "../../../../tests/fixtures/host-payloads/2.1.284/lifecycle.json" with { type: "json" };
import failure from "../../../../tests/fixtures/host-payloads/2.1.289/post-tool-failure.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import { ROOT } from "../../log/tests/support.ts";
import { harness, SCOUT, scouted, SESSION, spawn, TICKET, WORKER } from "./agent-support.ts";
import type { Harness } from "./agent-support.ts";

const JOURNAL = `${ROOT}/.bdk/.machine/telemetry/journal.jsonl`;
const MARKER = `${ROOT}/.bdk/.machine/verbose`;
const LIVE = `${ROOT}/.bdk/.machine/logs/${SESSION}.live.log`;
const TRANSCRIPT = `/home/dev/.claude/projects/-repo/${SESSION}.jsonl`;

function journal(h: Harness): Record<string, unknown>[] {
  return (h.store.read(JOURNAL) ?? "")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function lines(h: Harness, kind: string) {
  return journal(h).filter((line) => line.kind === kind);
}

/** The harness plugin has no startup text; session-start needs one. */
const sessionStart = (h: Harness) => {
  h.store.write(
    `${h.deps.pluginRoot}/STARTUP_INSTRUCTIONS.md`,
    "# BDK\n\n<!-- bdk:agents-table -->\n<!-- /bdk:agents-table -->\n",
  );
  return h.run(["hooks", "session-start"], {
    session_id: SESSION,
    transcript_path: TRANSCRIPT,
    source: "startup",
    hook_event_name: "SessionStart",
  });
};

const bash = {
  session_id: SESSION,
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: { command: "pnpm test\n  --run" },
  tool_response: { stdout: "one\ntwo\nthree\nfour", stderr: "" },
};

describe("run journal lines of the hooks", () => {
  it("writes the session line from the session-start payload", async () => {
    const h = harness();
    await sessionStart(h);
    expect(lines(h, "session")).toStrictEqual([
      {
        v: 1,
        kind: "session",
        at: expect.any(String) as string,
        session: SESSION,
        transcript: TRANSCRIPT,
        source: "startup",
        bdk: expect.any(String) as string,
        commit: null,
        host: null,
      },
    ]);
  });

  it("names the plugin commit of a git checkout, and none when git fails", async () => {
    const h = harness();
    h.store.write(`${h.deps.pluginRoot}/.git`, "gitdir: x\n");
    const run = h.deps.git.run.bind(h.deps.git);
    let fail = false;
    Object.assign(h.deps.git, {
      run: (args: readonly string[], cwd: string) =>
        args[0] !== "rev-parse"
          ? run(args, cwd)
          : fail
            ? Promise.reject(new Error("no git"))
            : Promise.resolve({ code: 0, stdout: "abc1234\n", stderr: "" }),
    });
    await sessionStart(h);
    fail = true;
    await sessionStart(h);
    expect(lines(h, "session").map((line) => line.commit)).toStrictEqual(["abc1234", null]);
  });

  it("writes agent-start with the parent and ticket, and agent-stop for each way an agent ends", async () => {
    const h = harness();
    await scouted(h);
    expect(lines(h, "agent-start")).toMatchObject([
      { agent: WORKER, type: "bdk:worker", parent: "main", ticket: TICKET, session: SESSION },
      { agent: SCOUT, type: "bdk:scout", parent: WORKER, ticket: null, session: SESSION },
    ]);
    await h.run(["hooks", "post-tool"], spawn(undefined, SCOUT, "bdk:runner", "run", "completed"));
    await h.run(["hooks", "post-tool"], {
      session_id: SESSION,
      tool_name: "TaskStop",
      tool_input: { task_id: WORKER },
      tool_response: { task_type: "local_agent" },
    });
    const stop = lifecycle.payloads.find((payload) => payload.hook_event_name === "SubagentStop");
    await h.run(["hooks", "subagent-stop"], stop);
    expect(lines(h, "agent-stop")).toMatchObject([
      { agent: SCOUT, by: "agent-result", transcript: null, session: SESSION },
      { agent: WORKER, by: "task-stop", transcript: null, session: SESSION },
      { agent: stop?.agent_id, by: "subagent-stop", transcript: stop?.agent_transcript_path },
    ]);
  });

  it("counts the questions of an AskUserQuestion call", async () => {
    const h = harness();
    await h.run(["hooks", "post-tool"], {
      session_id: SESSION,
      tool_name: "AskUserQuestion",
      tool_input: { questions: [{ question: "a" }, { question: "b" }] },
      tool_response: {},
    });
    expect(lines(h, "question")).toMatchObject([{ agent: "main", count: 2, session: SESSION }]);
  });
});

describe("verbose lines of the hooks", () => {
  it("writes a live line only with the marker, and marks a failed call", async () => {
    const h = harness();
    await h.run(["hooks", "post-tool"], bash);
    expect(h.store.exists(LIVE)).toBe(false);
    h.store.write(MARKER, "");
    await h.run(["hooks", "post-tool"], bash);
    const [failed] = failure.payloads.filter(
      (payload) => payload.hook_event_name === "PostToolUseFailure",
    );
    await h.run(["hooks", "post-tool"], { ...failed, session_id: SESSION });
    const live = (h.store.read(LIVE) ?? "").split("\n");
    expect(live[0]).toMatch(/^\d\d:\d\d:\d\d main Bash pnpm test --run ok$/);
    expect(live.slice(1, 4)).toStrictEqual(["    one", "    two", "    three"]);
    expect(live[4]).toMatch(
      /^\d\d:\d\d:\d\d main Bash sh -c 'echo probe-fail >&2; exit 2' failed$/,
    );
    expect(live[5]).toBe("    Exit code 2");
    expect(live[6]).toBe("    probe-fail");
  });

  it("renders the session at session end and names the file in the context", async () => {
    const h = harness();
    await sessionStart(h);
    const quiet = await h.run(["hooks", "session-end"], { session_id: SESSION, reason: "clear" });
    expect(quiet.stdout).not.toContain("verbose log");
    h.store.write(MARKER, "");
    const ended = await h.run(["hooks", "session-end"], { session_id: SESSION, reason: "clear" });
    const path = /\[BDK\] verbose log (\S+)/.exec(ended.stdout)?.[1] ?? "";
    expect(path).toMatch(new RegExp(`^\\.bdk/\\.machine/logs/.*${SESSION}\\.log$`));
    expect(h.store.read(`${ROOT}/${path}`)).toContain(`# BDK run log of session ${SESSION}`);
  });

  it("names why the render was not written", async () => {
    const h = harness();
    h.store.write(MARKER, "");
    const unknown = await h.run(["hooks", "session-end"], { session_id: SESSION, reason: "clear" });
    expect(unknown.stdout).toContain(
      `[BDK] verbose log not written: the run journal has no line of session ${SESSION}`,
    );
  });
});
