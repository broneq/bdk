import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ToolCall } from "../../harness/hook.ts";
import {
  acceptance,
  acceptanceScore,
  envelopeBytes,
  kernelCalls,
  readV2State,
  readV3State,
  v2Completeness,
  v3Completeness,
} from "./metrics.ts";
import type { Exec, V3State } from "./metrics.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-metrics-"));
  dirs.push(dir);
  return dir;
}

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@x", ...args], {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
  }).trim();
}

const PARTS = [
  { id: "01", tasks: ["01-1", "01-2"] },
  { id: "02", tasks: ["02-1"] },
];

function bash(command: string, output: string, parent?: string): ToolCall {
  return { name: "Bash", input: { command }, output, parentToolUseId: parent ?? null };
}

const KERNEL = 'node "/plugin/dist/bdk.mjs"';

function framed(report: string): string {
  return `[Subagent hand-back] The text below is the final report of a subagent. The report follows:\n  ${report}\nagentId: a1 (use SendMessage)\n<usage>tool_uses: 1</usage>`;
}

function agent(type: string, report: string | null, extra: Record<string, unknown> = {}): ToolCall {
  return {
    name: "Agent",
    input: { subagent_type: type, prompt: "p", ...extra },
    output: report === null ? "Async agent launched" : [{ type: "text", text: framed(report) }],
    parentToolUseId: null,
  };
}

describe("acceptanceScore", () => {
  it("is 1 when every check passes and the fraction otherwise", () => {
    expect(acceptanceScore({ hidden: true, suite: true, typecheck: true, lint: true })).toBe(1);
    expect(acceptanceScore({ hidden: false, suite: true, typecheck: true, lint: false })).toBe(0.5);
  });
});

describe("acceptance", () => {
  it("runs the suite before copying the hidden tests, then the hidden tests, tsc and eslint on changed files", () => {
    const work = temp();
    const hidden = temp();
    git(work, "init", "-q", "-b", "main");
    write(work, "src/a.ts", "a\n");
    write(work, "README.md", "r\n");
    git(work, "add", "--all");
    git(work, "commit", "-q", "-m", "base");
    git(work, "checkout", "-q", "-b", "feat/eval");
    write(work, "src/a.ts", "b\n");
    write(work, "src/new.tsx", "n\n");
    write(work, "README.md", "changed\n");
    write(hidden, "src/x.hidden.test.ts", "h\n");

    const calls: string[][] = [];
    const exec: Exec = (command, args, cwd) => {
      calls.push([command, ...args]);
      expect(cwd).toBe(work);
      return command === "npx" && args[0] === "eslint" ? 1 : 0;
    };
    const checks = acceptance(work, hidden, exec);
    expect(checks).toEqual({ suite: true, hidden: true, typecheck: true, lint: false });
    expect(calls).toEqual([
      ["npx", "vitest", "run"],
      ["npx", "vitest", "run", "src/x.hidden.test.ts"],
      ["npx", "tsc", "-b", "--pretty", "false"],
      ["npx", "eslint", "src/a.ts", "src/new.tsx"],
    ]);
  });

  it("passes lint when no source file changed", () => {
    const work = temp();
    git(work, "init", "-q", "-b", "main");
    write(work, "src/a.ts", "a\n");
    git(work, "add", "--all");
    git(work, "commit", "-q", "-m", "base");
    const calls: string[][] = [];
    const checks = acceptance(work, temp(), (command, args) => {
      calls.push([command, ...args]);
      return 1;
    });
    expect(checks.lint).toBe(true);
    expect(calls.some((call) => call[1] === "eslint")).toBe(false);
  });
});

describe("kernelCalls", () => {
  it("counts every kernel call, in the orchestrator and in subagents, and its exit class", () => {
    const calls: ToolCall[] = [
      bash(`${KERNEL} next --json`, '{"artifact":"execute-part:01"}'),
      bash(
        `${KERNEL} attempt close A-1 ok --json`,
        'Exit code 2\n{"refused": true, "rule": "policy/missing-evidence"}',
      ),
      bash(`${KERNEL} part strat 01`, "refused: input/unknown-command\nwhy: x", "toolu_1"),
      bash(
        `${KERNEL} evidence record x`,
        '{\n  "refused": true,\n  "rule": "input/invalid-argument"\n}',
        "toolu_1",
      ),
      bash(`${KERNEL} change status`, "Exit code 4\nstate problem"),
      bash("npx vitest run", "Exit code 1\nfailed"),
      { name: "Read", input: { file_path: "dist/bdk.mjs" }, output: "x" },
    ];
    expect(kernelCalls(calls)).toEqual({ calls: 5, exit3: 2, exit2: 1 });
  });

  it("counts a call through the plugin's bdk launcher like one by the bundle path", () => {
    const calls: ToolCall[] = [
      bash("bdk next --json", '{"artifact":"execute-part:01"}'),
      bash("cd app && bdk part strat 01", "refused: input/unknown-command\nwhy: x", "toolu_1"),
      bash("echo bdk is the kernel", "bdk is the kernel"),
      bash("ls ./bdk-notes", ""),
    ];
    expect(kernelCalls(calls)).toEqual({ calls: 2, exit3: 1, exit2: 0 });
  });
});

describe("envelopeBytes", () => {
  it("is the mean byte length of the reports role subagents returned, skipping background launches", () => {
    const calls: ToolCall[] = [
      agent("bdk:worker", "status: done"),
      agent("bdk:runner", "status: blocked, zażółć"),
      agent("bdk:worker", null, { run_in_background: true }),
      agent("general-purpose", "a long report that is not a role envelope"),
    ];
    const first = Buffer.byteLength("status: done");
    const second = Buffer.byteLength("status: blocked, zażółć");
    expect(envelopeBytes(calls)).toBe((first + second) / 2);
  });

  it("is null without a role return", () => {
    expect(envelopeBytes([agent("bdk:worker", null)])).toBeNull();
  });
});

function fullV3(): V3State {
  const tasks = PARTS.flatMap((part) => part.tasks);
  return {
    attempts: tasks.map((task) => ({
      ticket: `A-${task}`,
      loop: "task-redispatch",
      target: task,
      outcome: "ok",
    })),
    packages: tasks.flatMap((task) =>
      ["implementer", "simplifier", "runner"].map((role) => ({
        task,
        role,
        ticket: `A-${task}`,
        templateHash: `sha256:${role}`,
      })),
    ),
    reports: tasks.flatMap((task) =>
      ["implementer", "simplifier"].map((role) => ({ task, role, ticket: `A-${task}` })),
    ),
    evidence: tasks.flatMap((task) =>
      ["simplify", "tests-scoped", "lint"].map((kind) => ({
        kind,
        target: task,
        ticket: `A-${task}`,
        verdict: "pass",
      })),
    ),
    trailerTasks: tasks,
    partsDone: ["01", "02"],
  };
}

describe("v3Completeness", () => {
  it("is 1 when every step of every task and part is present", () => {
    expect(v3Completeness(PARTS, fullV3())).toBe(1);
  });

  it("counts seven steps per task and one per part", () => {
    const state = fullV3();
    const partial: V3State = {
      ...state,
      evidence: state.evidence.filter(
        (entry) => !(entry.target === "01-2" && entry.kind === "lint"),
      ),
      partsDone: ["01"],
    };
    expect(v3Completeness(PARTS, partial)).toBeCloseTo(21 / 23);
  });

  it("counts evidence only from a ticket that closed ok", () => {
    const state = fullV3();
    const failed: V3State = {
      ...state,
      attempts: state.attempts.map((entry) =>
        entry.target === "02-1" ? { ...entry, outcome: "fail" } : entry,
      ),
    };
    // 02-1 keeps its ticket, package, report and commit; its three evidence steps do not count.
    expect(v3Completeness(PARTS, failed)).toBeCloseTo(20 / 23);
  });
});

describe("readV3State", () => {
  it("reads attempts, packages, reports, evidence, task trailers and part transitions", () => {
    const work = temp();
    git(work, "init", "-q", "-b", "main");
    const change = ".bdk/changes/2026-09-28-x";
    write(
      work,
      `${change}/attempts/task-redispatch-01-1-A-a.md`,
      "---\nschema: 1\nticket: A-a\nloop: task-redispatch\ntarget: 01-1\nattempt: 1\noutcome: ok\n---\n",
    );
    write(
      work,
      `${change}/attempts/task-redispatch-01-2-A-b.md`,
      "---\nticket: A-b\nloop: task-redispatch\ntarget: 01-2\n---\n",
    );
    write(
      work,
      `${change}/dispatch/01-1-implementer-A-a.md`,
      "---\nticket: A-a\ntarget: 01-1\nrole: implementer\ntemplate-hash: sha256:abc\n---\nbody\n",
    );
    write(
      work,
      `${change}/reports/01-1-implementer-A-a.md`,
      "---\nticket: A-a\nrole: implementer\nstatus: done\n---\n",
    );
    write(
      work,
      `${change}/evidence/01-1-E-x.md`,
      "---\nid: E-x\nkind: lint\nticket: A-a\ntarget: 01-1\ntree:\n  - path: a\n    hash: absent\nverdict: pass\n---\n",
    );
    write(work, `${change}/evidence/01-1-E-x-lint.txt`, "ok\n");
    write(
      work,
      `${change}/log/20260928T1Z-transition-L-a.md`,
      "---\ntype: transition\nsummary: execute-part:01 done\nrefs:\n  - execute-part:01\n---\n",
    );
    write(
      work,
      `${change}/log/20260928T0Z-transition-L-b.md`,
      "---\ntype: transition\nsummary: part 02 started\nrefs:\n  - execute-part:02\n---\n",
    );
    git(work, "add", "--all");
    git(
      work,
      "commit",
      "-q",
      "-m",
      "Audit rows",
      "--trailer",
      "BDK-Part=01",
      "--trailer",
      "BDK-Task=01-1",
    );
    git(work, "commit", "-q", "--allow-empty", "-m", "unrelated");

    expect(readV3State(work)).toEqual({
      attempts: [
        { ticket: "A-a", loop: "task-redispatch", target: "01-1", outcome: "ok" },
        { ticket: "A-b", loop: "task-redispatch", target: "01-2", outcome: null },
      ],
      packages: [{ task: "01-1", role: "implementer", ticket: "A-a", templateHash: "sha256:abc" }],
      reports: [{ task: "01-1", role: "implementer", ticket: "A-a" }],
      evidence: [{ kind: "lint", target: "01-1", ticket: "A-a", verdict: "pass" }],
      trailerTasks: ["01-1"],
      partsDone: ["01"],
    });
  });

  it("is empty when the session never opened a Change", () => {
    const work = temp();
    git(work, "init", "-q", "-b", "main");
    git(work, "commit", "-q", "--allow-empty", "-m", "base");
    expect(readV3State(work)).toEqual({
      attempts: [],
      packages: [],
      reports: [],
      evidence: [],
      trailerTasks: [],
      partsDone: [],
    });
  });
});

describe("v2Completeness", () => {
  const calls: ToolCall[] = [
    agent("bdk:implementer", "done"),
    agent("bdk:test-runner", "pass"),
    agent("bdk:static-analyse", "clean"),
    agent("bdk:implementer", "done"),
    agent("bdk:static-analyse", "clean"),
    agent("bdk:implementer", "done"),
  ];

  it("counts trailer commits, implementers, verifiers after each implementer and the manifest", () => {
    const state = { groups: ["1", "2"], manifestGroups: ["1", "2"] };
    // 3 groups, 3 tasks: commits 2/3, implementers 3/3, test-runner windows 1/3,
    // static-analyse windows 2/3, manifest incomplete 0/1.
    expect(v2Completeness({ groups: 3, tasks: 3 }, calls, state)).toBeCloseTo(8 / 13);
  });

  it("is 1 when every group is committed, verified and in the manifest", () => {
    const full: ToolCall[] = [1, 2].flatMap(() => [
      agent("bdk:implementer", "done"),
      agent("bdk:test-runner", "pass"),
      agent("bdk:static-analyse", "clean"),
    ]);
    expect(
      v2Completeness({ groups: 2, tasks: 2 }, full, {
        groups: ["1", "2"],
        manifestGroups: ["1", "2"],
      }),
    ).toBe(1);
  });
});

describe("readV2State", () => {
  it("reads the groups committed with this run's trailers and the manifest's done groups", () => {
    const work = temp();
    git(work, "init", "-q", "-b", "main");
    git(work, "commit", "-q", "--allow-empty", "-m", "base");
    git(
      work,
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "g1",
      "--trailer",
      "BDK-Run=r1",
      "--trailer",
      "BDK-Group=1",
    );
    git(work, "commit", "-q", "--allow-empty", "-m", "g2 without run", "--trailer", "BDK-Group=2");
    git(
      work,
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "g3",
      "--trailer",
      "BDK-Run=r1",
      "--trailer",
      "BDK-Group=3",
    );
    write(
      work,
      ".bdk/runs/r1.json",
      JSON.stringify({ run_id: "r1", groups_done: { "1": "abc", "3": "def" } }),
    );
    expect(readV2State(work)).toEqual({ groups: ["1", "3"], manifestGroups: ["1", "3"] });
  });

  it("has no manifest groups without a run manifest", () => {
    const work = temp();
    git(work, "init", "-q", "-b", "main");
    git(work, "commit", "-q", "--allow-empty", "-m", "base");
    expect(readV2State(work)).toEqual({ groups: [], manifestGroups: null });
  });
});
