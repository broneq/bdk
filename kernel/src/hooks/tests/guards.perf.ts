// The guard latency budgets (`kernel-cli/hooks`, Guard latency) through the
// guard scripts and the built bundle, run as the host runs them. Wall-clock
// timing depends on the machine, so this runs in the `perf` project, which CI
// does not run: `pnpm build && pnpm test:perf` locally.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import { bdk } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { opened } from "../../graph/tests/e2e-support.ts";
import { agentCall, mainBash, PACKAGE, recorded, preEdit, subagentBash } from "./payloads.ts";
import type { Payload } from "./payloads.ts";

interface HookFile {
  hooks: Record<string, { hooks: { command: string }[] }[]>;
}

const HOOKS = (JSON.parse(readFileSync(join(REPO_ROOT, "hooks/hooks.json"), "utf8")) as HookFile)
  .hooks;
const PRE_TOOL = HOOKS.PreToolUse?.[0]?.hooks[0]?.command ?? "";
const PROMPT_EXPANSION = HOOKS.UserPromptExpansion?.[0]?.hooks[0]?.command ?? "";

const COMMANDS = [
  "ls -la src",
  "pnpm test 2>&1 | tail -20",
  "git status",
  "git diff HEAD~1 -- src/app.ts",
  "cat package.json",
  "grep -rn TODO src",
  "node scripts/check.js --fast",
  "echo done > /dev/null",
];

interface Sample {
  readonly payload: Payload;
  /** Whether the prefilter hands it to the kernel. */
  readonly reaches: boolean;
}

/**
 * 750 recorded-shape payloads in a project whose path contains `git`:
 * main-thread and subagent Bash, edits, and Agent calls to v2 and BDK agents.
 * A subagent payload always reaches the kernel here, through the path.
 */
function corpus(project: string): Sample[] {
  const at = (payload: Payload, reaches: boolean): Sample => ({
    payload: { ...payload, cwd: project },
    reaches,
  });
  return Array.from({ length: 750 }, (_, i) => {
    const command = COMMANDS[i % COMMANDS.length] ?? "ls";
    switch (i % 6) {
      case 0:
      case 1:
        return at(mainBash(command), false);
      case 2:
        return at(subagentBash(command, i % 12 === 2 ? "bdk:reviewer" : "bdk:worker"), true);
      case 3:
        return at(recorded(preEdit, { file_path: `${project}/src/file-${String(i)}.ts` }), false);
      case 4:
        return at(agentCall("bdk:explorer", `Find the callers of handler${String(i)}.`), false);
      default:
        return at(agentCall("bdk:worker", `${PACKAGE} Start with the failing test.`), true);
    }
  });
}

function run(
  command: string,
  cwd: string,
  payload: Payload,
): { ms: number; status: number | null } {
  const start = performance.now();
  const result = spawnSync("/bin/sh", ["-c", command], {
    cwd,
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO_ROOT, HOME: cwd },
  });
  return { ms: performance.now() - start, status: result.status };
}

function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
}

describe("guard latency", () => {
  it("stays within the three p95 budgets [NFR-LAT-2] [NFR-LAT-3] [NFR-LAT-4] [R-15]", () => {
    const project = createFixture({ files: { "README.md": "# app\n" }, git: false });
    const root = join(project.root, "my-git-app");
    const { root: repo } = opened();
    try {
      // What the prefilter adds to the shell the host starts anyway: each
      // hook run is paired with a bare `sh -c` reading the same payload.
      const dropped: number[] = [];
      const kernel: number[] = [];
      for (const { payload, reaches } of corpus(root)) {
        const hook = run(PRE_TOOL, project.root, payload);
        expect(hook.status).toBe(0);
        if (reaches) kernel.push(hook.ms);
        else dropped.push(hook.ms - run("cat >/dev/null", project.root, payload).ms);
      }

      // The first run warms the file cache for the bundle; it is not counted.
      const expansion: number[] = [];
      for (let i = -1; i < 30; i++) {
        const payload = {
          hook_event_name: "UserPromptExpansion",
          expansion_type: "slash_command",
          session_id: "sess-perf",
          command_name: "bdk:execute",
          command_args: i % 2 === 0 ? "--skip-verify" : "",
          prompt: "/bdk:execute",
        };
        const hook = run(PROMPT_EXPANSION, repo, payload);
        expect(hook.status).toBe(0);
        if (i >= 0) expansion.push(hook.ms);
      }
      expect(bdk(["change", "status", "--json"], repo).code).toBe(0);

      const report = {
        droppedAddedP95: p95(dropped),
        preToolKernelP95: p95(kernel),
        promptExpansionP95: p95(expansion),
      };
      console.info(
        `guard latency p95: dropped prefilter +${report.droppedAddedP95.toFixed(1)} ms (${String(dropped.length)} runs), pre-tool through the kernel ${report.preToolKernelP95.toFixed(1)} ms (${String(kernel.length)} runs), writing prompt-expansion ${report.promptExpansionP95.toFixed(1)} ms (${String(expansion.length)} runs)`,
      );
      expect(dropped.length).toBeGreaterThan(300);
      expect(kernel.length).toBeGreaterThan(200);
      expect(report.droppedAddedP95).toBeLessThan(5);
      expect(report.preToolKernelP95).toBeLessThan(150);
      expect(report.promptExpansionP95).toBeLessThan(150);
    } finally {
      project.remove();
    }
  }, 300_000);
});
