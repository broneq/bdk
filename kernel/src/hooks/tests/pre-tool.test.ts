import { memoryRegistry } from "../../shared/store/index.ts";
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import {
  fakeGit,
  logDeps,
  repository as memoryRepository,
  runBdk,
} from "../../log/tests/support.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import { preToolBlock } from "../commands/pre-tool.ts";
import { hooksRegistrations } from "../index.ts";
import { preToolOutput } from "../schema/pre-tool.ts";
import { decidePreTool } from "../use-cases/pre-tool.ts";
import {
  agentCall,
  agentFg,
  BAD_PROMPTS,
  deniedPayloads,
  GIT_DENIED,
  kernel,
  mainBash,
  NESTED_DENIED,
  PACKAGE,
  PROJECT,
  preEdit,
  preNotebook,
  preWrite,
  READER_WRITES,
  recorded,
  SPEC,
  SPEC_WRITES,
  subagentBash,
} from "./payloads.ts";
import type { Payload } from "./payloads.ts";

const index = loadIndex(commands);

function decide(payload: Payload | string) {
  return decidePreTool(index, typeof payload === "string" ? payload : JSON.stringify(payload));
}

function denied(payload: Payload): { rule: string; why: string } {
  const outcome = decide(payload);
  if (!isRefusal(outcome)) throw new Error(`expected a deny, got ${JSON.stringify(outcome)}`);
  return { rule: outcome.rule, why: outcome.why };
}

function passes(payload: Payload): boolean {
  return !isRefusal(decide(payload));
}

describe("hooks pre-tool: subagent git", () => {
  it.each(GIT_DENIED)("denies `%s` as %s", (command, verb) => {
    const { rule, why } = denied(subagentBash(command));
    expect(rule).toBe("guard/subagent-git");
    expect(why).toBe(
      `subagents may not run ${verb}; return blocked with the cause instead of changing the shared working tree or history (BDK T3)`,
    );
  });

  it.each([
    "git status",
    "git diff HEAD",
    "git log --oneline -5",
    "git checkout feature/login",
    "git switch main",
    'echo "git stash"',
    "grep -r 'git reset' docs",
  ])("passes `%s`", (command) => {
    expect(passes(subagentBash(command))).toBe(true);
  });

  it("reads a quoted verb inside an argument as text, not as a command", () => {
    expect(denied(subagentBash('git commit -m "revert with git reset"')).why).toContain(
      "git commit",
    );
  });

  it("never touches main-thread git", () => {
    expect(decide(mainBash("git stash"))).toStrictEqual({
      decision: "pass",
      tool: "Bash",
      subagent: false,
    });
  });
});

describe("hooks pre-tool: kernel commands", () => {
  it("denies a subagent's orchestrator verb, naming it and its class", () => {
    expect(denied(subagentBash(kernel("commit 02-3")))).toStrictEqual({
      rule: "guard/subagent-kernel-command",
      why: "subagents may not run bdk commit, an orchestrator command; return blocked with the cause, the orchestrator runs it (BDK T3)",
    });
  });

  it("classifies every orchestrator verb of the index", () => {
    const orchestrator = index.commands.filter((record) => record.availability === "orchestrator");
    expect(orchestrator.length).toBeGreaterThan(0);
    for (const record of orchestrator) {
      expect(denied(subagentBash(kernel(record.argv.join(" ")))).rule).toBe(
        "guard/subagent-kernel-command",
      );
    }
  });

  it.each([
    "attempt list --json",
    'log add finding "x" --ref a.ts',
    "commit --help",
    "no-such-verb",
  ])("passes a subagent's `bdk %s`", (argv) => {
    expect(passes(subagentBash(kernel(argv)))).toBe(true);
  });

  it("passes main-thread orchestrator verbs", () => {
    expect(passes(mainBash(kernel("commit 02-3")))).toBe(true);
  });

  it.each([
    ["the main thread", mainBash],
    ["a subagent", (command: string) => subagentBash(command)],
  ])("denies bdk.mjs hooks from %s", (_, payload) => {
    expect(denied(payload(`${kernel("hooks prompt-expansion")} < upe.json`))).toStrictEqual({
      rule: "guard/hooks-from-bash",
      why: "bdk hooks prompt-expansion runs only from the host's hooks; stop and let the user type the stage command (BDK T1)",
    });
  });

  it("reads the bundle run directly and after node's options", () => {
    expect(denied(subagentBash("./dist/bdk.mjs hooks pre-tool")).rule).toBe(
      "guard/hooks-from-bash",
    );
    expect(denied(subagentBash("node --no-warnings dist/bdk.mjs commit 1")).rule).toBe(
      "guard/subagent-kernel-command",
    );
  });

  it("reads a bdk shell function as the kernel", () => {
    const viaFunction = 'bdk() { node /p/dist/bdk.mjs "$@"; }; bdk commit 01-1';
    const deny = denied(subagentBash(viaFunction));
    expect(deny.rule).toBe("guard/subagent-kernel-command");
    expect(deny.why).toMatch(/^subagents may not run bdk commit/);
    expect(denied(subagentBash("bdk hooks pre-tool")).rule).toBe("guard/hooks-from-bash");
    expect(passes(subagentBash('bdk() { node /p/dist/bdk.mjs "$@"; }; bdk log show L-1'))).toBe(
      true,
    );
  });
});

describe("hooks pre-tool: nested stage commands", () => {
  it.each(NESTED_DENIED)("denies `%s` in the main thread", (command, typed) => {
    expect(denied(mainBash(command))).toStrictEqual({
      rule: "guard/nested-stage-command",
      why: `a nested claude session would type ${typed} as the user; stop and ask the user to type it (BDK T1)`,
    });
  });

  it.each(['claude -p "/bdk:design"', 'echo "claude -p /bdk:plan"', "claude --version"])(
    "passes `%s`",
    (command) => {
      expect(passes(mainBash(command))).toBe(true);
    },
  );
});

describe("hooks pre-tool: spec directory", () => {
  it.each([
    ["Edit", preEdit, "file_path"],
    ["Write", preWrite, "file_path"],
    ["NotebookEdit", preNotebook, "notebook_path"],
  ])("denies %s under .bdk/specs/", (_, fixture, field) => {
    expect(denied(recorded(fixture, { [field]: SPEC }))).toStrictEqual({
      rule: "guard/spec-dir-write",
      why: `${SPEC} is under .bdk/specs/, which only bdk spec merge writes at close; put the change into the Change's spec-delta/ (BDK V1-7)`,
    });
  });

  it("resolves a relative path against the payload's cwd", () => {
    expect(denied(recorded(preEdit, { file_path: ".bdk/specs/auth/spec.md" })).rule).toBe(
      "guard/spec-dir-write",
    );
    expect(passes(recorded(preEdit, { file_path: "src/.bdk-specs.md" }))).toBe(true);
  });

  it.each(SPEC_WRITES)("denies the Bash write `%s` in any thread", (command) => {
    expect(denied(mainBash(command)).rule).toBe("guard/spec-dir-write");
  });

  it.each(["cat .bdk/specs/auth/spec.md | grep Scenario", "cp .bdk/specs/a.md /tmp/a.md"])(
    "passes reading `%s`",
    (command) => {
      expect(passes(mainBash(command))).toBe(true);
    },
  );
});

describe("hooks pre-tool: read-only adapters", () => {
  it.each(READER_WRITES)("denies the write `%s` from bdk:reader", (command) => {
    const { rule, why } = denied(subagentBash(command, "bdk:reader"));
    expect(rule).toBe("guard/reader-write");
    expect(why).toMatch(/^the reader adapter may not write files \(.+\); report through/);
  });

  it.each(["bdk:reviewer", "bdk:scout"])("denies writes from %s", (adapter) => {
    expect(denied(subagentBash("echo x > notes.md", adapter)).rule).toBe("guard/reader-write");
  });

  it.each([
    "pnpm test 2>&1 | tail -5",
    "pnpm test > /dev/null",
    'node "$P/dist/bdk.mjs" log add finding "x" --ref a.ts --ticket A-7f3k9m2q',
    "node \"$P/dist/bdk.mjs\" log ingest --ticket A-7f3k9m2q <<'EOF'\na > b\ngit stash\nEOF",
    "sed -n 1,10p a.ts",
    "cp --help",
  ])("passes `%s` from bdk:reviewer", (command) => {
    expect(passes(subagentBash(command, "bdk:reviewer"))).toBe(true);
  });

  it("lets a worker write", () => {
    expect(passes(subagentBash("echo x > notes.md", "bdk:worker"))).toBe(true);
  });
});

describe("hooks pre-tool: dispatch prompts", () => {
  const reason =
    "a BDK dispatch prompt is the package path plus at most one sentence; put the context into the package (BDK T23-D0)";

  it.each([
    PACKAGE,
    `${PACKAGE} Start with the failing test.`,
    `Read ${PROJECT}/${PACKAGE} and start with the failing test.`,
    `Package: ./${PACKAGE}`,
  ])("passes `%s`", (prompt) => {
    expect(passes(agentCall("bdk:worker", prompt))).toBe(true);
  });

  it.each(BAD_PROMPTS)("denies %s", (_, prompt) => {
    expect(denied(agentCall("bdk:reader", prompt))).toStrictEqual({
      rule: "guard/dispatch-prompt",
      why: reason,
    });
  });

  it("holds an escalation package to its model", () => {
    const call = (model?: string) => {
      const payload = agentCall("bdk:worker", PACKAGE);
      const input = payload.tool_input as Payload;
      return JSON.stringify({ ...payload, tool_input: { ...input, model } });
    };
    const outcome = decidePreTool(index, call(), undefined, "opus");
    expect(isRefusal(outcome) && outcome.rule).toBe("guard/escalation-model");
    expect(isRefusal(outcome) && outcome.why).toBe(
      "the package belongs to an escalation ticket, so start bdk:worker with model: opus in the Agent call (BDK T41-D14)",
    );
    expect(isRefusal(decidePreTool(index, call("sonnet"), undefined, "opus"))).toBe(true);
    expect(isRefusal(decidePreTool(index, call("opus"), undefined, "opus"))).toBe(false);
    expect(isRefusal(decidePreTool(index, call()))).toBe(false);
  });

  it("leaves a v2 agent and the recorded probe untouched", () => {
    expect(passes(agentCall("bdk:explorer", "Find it. ".repeat(40)))).toBe(true);
    expect(passes(recorded(agentFg))).toBe(true);
  });
});

describe("hooks pre-tool: the shared corpus", () => {
  it.each(deniedPayloads())("denies %s", (_, payload) => {
    expect(isRefusal(decide(payload))).toBe(true);
  });
});

describe("hooks pre-tool: payload and output", () => {
  it.each([
    ["not JSON", "{", "a JSON body (it is not JSON)"],
    ["an array", "[]", "a JSON body (it is not a JSON object)"],
    ["without tool_input", JSON.stringify({ tool_name: "Bash" }), "tool_input"],
    ["without tool_name", JSON.stringify({ tool_input: {} }), "tool_name"],
  ])("refuses a payload %s", (_, raw, missing) => {
    const outcome = decide(raw);
    expect(isRefusal(outcome) && outcome.rule).toBe("input/invalid-argument");
    expect(isRefusal(outcome) && outcome.why).toBe(`the PreToolUse payload lacks ${missing}`);
  });

  it("reports a subagent pass", () => {
    expect(decide(subagentBash("ls"))).toStrictEqual({
      decision: "pass",
      tool: "Bash",
      subagent: true,
    });
  });

  it("prints the host's deny object with the rule-prefixed reason", () => {
    const outcome = decide(subagentBash("git stash"));
    if (!isRefusal(outcome)) throw new Error("expected a deny");
    expect(JSON.parse(preToolBlock(outcome))).toStrictEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `guard/subagent-git: subagents may not run git stash; return blocked with the cause instead of changing the shared working tree or history (BDK T3)\ninstead: ${outcome.instead.join("; ")}`,
      },
    });
  });
});

describe("hooks pre-tool through the registry", () => {
  const store = memoryRepository();
  const git = fakeGit();
  const registrations = hooksRegistrations({
    ...logDeps(store, git),
    commands: index,
    openRegistry: memoryRegistry(),
  });
  const run = (payload: Payload, json = false) =>
    runBdk(
      registrations,
      store,
      git,
      ["hooks", "pre-tool", ...(json ? ["--json"] : [])],
      JSON.stringify(payload),
    );

  it("is silent on a pass and answers the decision record under --json", async () => {
    expect(await run(mainBash("git stash"))).toMatchObject({ code: 0, stdout: "" });
    const result = await run(mainBash("git stash"), true);
    expect(preToolOutput.parse(result.json)).toStrictEqual({
      decision: "pass",
      tool: "Bash",
      subagent: false,
    });
  });

  it("prints the host's deny object and exits 2 on a block", async () => {
    const result = await run(subagentBash("git stash"));
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
    expect((await run(subagentBash("git stash"), true)).json).toMatchObject({
      rule: "guard/subagent-git",
    });
  });
});
