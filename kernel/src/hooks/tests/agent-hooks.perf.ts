// The agent-hook latency budgets of T41 (`kernel-cli/hooks`, Guard latency):
// the heartbeat the guard scripts write in the shell, the four agent hooks
// through the built bundle, and the wake-up of `agents wait`. Wall-clock
// timing depends on the machine, so this runs in the `perf` project, which CI
// does not run: `pnpm build && pnpm test:perf` locally.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, bdkAsync } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { dispatched, opened, started as change } from "../../attempt/tests/e2e-support.ts";
import { promptFor, SESSION, spawned, started } from "../../agents/tests/e2e-support.ts";

interface HookFile {
  hooks: Record<string, { hooks: { command: string }[] }[]>;
}

const HOOKS = (JSON.parse(readFileSync(join(REPO_ROOT, "hooks/hooks.json"), "utf8")) as HookFile)
  .hooks;
const PRE_TOOL = HOOKS.PreToolUse?.[0]?.hooks[0]?.command ?? "";
const POST_TOOL = HOOKS.PostToolUse?.[0]?.hooks[0]?.command ?? "";

const LEAD = "a9f8e7d6c5b4a3f2e";
const WORKER = "a1b2c3d4e5f6a7b8c";
const RUNS = 30;

function timed(command: string, args: readonly string[], cwd: string, input: string): number {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    input,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO_ROOT, CLAUDE_PROJECT_DIR: cwd, HOME: cwd },
  });
  expect(result.status, String(result.stderr)).toBe(0);
  return performance.now() - start;
}

function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
}

/** A subagent's `Read`, which the prefilter drops after the heartbeat. */
function read(event: string): string {
  return JSON.stringify({
    session_id: SESSION,
    agent_id: WORKER,
    agent_type: "bdk:worker",
    hook_event_name: event,
    tool_name: "Read",
    tool_input: { file_path: "/app/src/login.ts" },
    ...(event === "PostToolUse" ? { tool_response: { type: "text" } } : {}),
  });
}

describe("agent hook latency", () => {
  it("stays within the heartbeat, agent-hook and wait budgets", async () => {
    const started_ = change();
    const root = started_.root;
    mkdirSync(join(root, ".bdk/.machine"), { recursive: true });
    const ticket = opened(started_, "task-redispatch", "01-1");
    const path = dispatched(started_, ticket, "01-1");
    spawned(root, { child: LEAD, type: "bdk:lead", prompt: "lead part 01" });
    started(root, LEAD, "bdk:lead");
    spawned(root, {
      parent: { id: LEAD, type: "bdk:lead" },
      child: WORKER,
      type: "bdk:worker",
      prompt: promptFor(path),
    });
    started(root, WORKER, "bdk:worker");

    // The heartbeat: what each script adds over a bare `sh -c` reading the same payload.
    const beat = { pre: [] as number[], post: [] as number[] };
    for (let i = -1; i < 200; i++) {
      const bare = timed("/bin/sh", ["-c", "cat >/dev/null"], root, read("PreToolUse"));
      const pre = timed("/bin/sh", ["-c", PRE_TOOL], root, read("PreToolUse"));
      const post = timed("/bin/sh", ["-c", POST_TOOL], root, read("PostToolUse"));
      if (i < 0) continue;
      beat.pre.push(pre - bare);
      beat.post.push(post - bare);
    }

    // The four agent hooks through the bundle; the first run warms the file cache.
    const bundle = join(REPO_ROOT, "dist/bdk.mjs");
    const hook = (verb: string, payload: unknown): number[] => {
      const samples: number[] = [];
      for (let i = -1; i < RUNS; i++) {
        const ms = timed(process.execPath, [bundle, "hooks", verb], root, JSON.stringify(payload));
        if (i >= 0) samples.push(ms);
      }
      return samples;
    };
    const agent = { session_id: SESSION, cwd: root, agent_id: WORKER, agent_type: "bdk:worker" };
    const kernel = {
      subagentStart: p95(hook("subagent-start", { ...agent, hook_event_name: "SubagentStart" })),
      subagentStop: p95(
        hook("subagent-stop", {
          ...agent,
          hook_event_name: "SubagentStop",
          stop_hook_active: false,
          background_tasks: [{ id: LEAD, type: "subagent", status: "running" }],
        }),
      ),
      stop: p95(hook("stop", { session_id: SESSION, cwd: root, hook_event_name: "Stop" })),
      postTool: p95(
        hook("post-tool", {
          session_id: SESSION,
          cwd: root,
          agent_id: LEAD,
          agent_type: "bdk:lead",
          hook_event_name: "PostToolUse",
          tool_name: "Agent",
          tool_input: { subagent_type: "bdk:worker", prompt: promptFor(path) },
          tool_response: { isAsync: true, status: "async_launched", agentId: WORKER },
        }),
      ),
    };

    // `agents wait`: from the stored report to the return.
    const waiting = bdkAsync(["agents", "wait", LEAD, "--timeout", "30", "--json"], root);
    await new Promise((done) => setTimeout(done, 1500));
    const at = performance.now();
    answered(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], root, {
        stdin: "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n",
      }),
      "output/log-ingest.json",
    );
    const ingested = performance.now();
    expect((await waiting).code).toBe(0);
    // Measured from the start of the ingest, so a return during the write counts in full.
    const wake = performance.now() - at;

    console.info(
      `agent hook latency p95: heartbeat pre-tool.sh +${p95(beat.pre).toFixed(1)} ms, post-tool.sh +${p95(beat.post).toFixed(1)} ms (${String(beat.pre.length)} runs each); subagent-start ${kernel.subagentStart.toFixed(1)} ms, subagent-stop ${kernel.subagentStop.toFixed(1)} ms, stop ${kernel.stop.toFixed(1)} ms, post-tool ${kernel.postTool.toFixed(1)} ms (${String(RUNS)} runs each); agents wait returned ${wake.toFixed(0)} ms after the ingest began (ingest took ${(ingested - at).toFixed(0)} ms)`,
    );
    expect(p95(beat.pre)).toBeLessThan(5);
    expect(p95(beat.post)).toBeLessThan(5);
    for (const value of Object.values(kernel)) expect(value).toBeLessThan(150);
    expect(wake).toBeLessThan(1500);
  }, 300_000);
});
