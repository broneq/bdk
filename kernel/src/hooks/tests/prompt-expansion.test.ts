// `hooks prompt-expansion` through the registry on a memory repository, one
// test per row of `kernel-cli/hooks`, Prompt-expansion outcomes, driven by
// the recorded `upe-typed.json` payload.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import upeTyped from "../../../../tests/fixtures/host-payloads/2.1.281/upe-typed.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import { graphRegistrations } from "../../graph/index.ts";
import {
  passGate,
  setChange,
  withPluginFiles,
  writeDesign,
  writeDesignVerdict,
} from "../../graph/tests/support.ts";
import { logRegistrations } from "../../log/index.ts";
import { fakeGit, repository, ROOT, runBdk, sequentialRandom } from "../../log/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import {
  memoryIndex,
  memoryRegistry,
  memoryStore,
  readDocument,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { hooksRegistrations } from "../index.ts";
import { promptExpansionOutput } from "../schema/prompt-expansion.ts";
import type { HooksDeps } from "../index.ts";

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T10:05:00.000Z";
const T2 = "2026-09-25T10:10:00.000Z";
const PLUGIN = "/plugins/bdk";
const DIR = `${ROOT}/.bdk/changes/2026-09-25-login`;

interface Harness {
  readonly store: Store;
  run(argv: readonly string[], stdin?: string, at?: string): Promise<RunResult>;
}

function harness(store: Store = withPluginFiles(repository())): Harness {
  const git = fakeGit();
  const random = sequentialRandom();
  return {
    store,
    run: (argv, stdin = "", at = T1) => {
      const deps: HooksDeps = {
        store,
        git,
        openIndex: memoryIndex,
        openRegistry: memoryRegistry(),
        clock: fixedClock(at),
        random,
        pluginRoot: PLUGIN,
        settings: settingsRegistry(),
        commands: loadIndex(commands),
      };
      return runBdk(
        [...hooksRegistrations(deps), ...graphRegistrations(deps), ...logRegistrations(deps)],
        store,
        git,
        argv,
        stdin,
      );
    },
  };
}

/** The recorded typed payload, renamed to `name` with `args`. */
function typed(name: string, args = "", fields: Record<string, unknown> = {}): string {
  const recorded = upeTyped.payloads[0] as Record<string, unknown>;
  return JSON.stringify({
    ...recorded,
    session_id: "sess-1",
    command_name: name,
    command_args: args,
    prompt: `/${name}${args === "" ? "" : ` ${args}`}`,
    ...fields,
  });
}

function expand(h: Harness, payload: string, at = T1) {
  return h.run(["hooks", "prompt-expansion", "--json"], payload, at);
}

async function designDone(h: Harness): Promise<void> {
  writeDesign(h.store, "design");
  writeDesign(h.store, "architecture");
  await h.run(["done", "design"], "", T0);
  await h.run(["done", "architecture"], "", T0);
  writeDesignVerdict(h.store, T0);
  await h.run(["done", "design-verify"], "", T0);
}

function transitions(store: Store): Record<string, unknown>[] {
  return store
    .list(`${DIR}/log`)
    .filter((name) => name.includes("-transition-"))
    .flatMap((name) => {
      const document = readDocument(store, `${DIR}/log/${name}`);
      return document !== undefined && "data" in document ? [document.data] : [];
    })
    .filter((data) => data.source !== "kernel" || data["input-hash"] === undefined);
}

describe("hooks prompt-expansion", () => {
  it("passes a ready gate: source user with the fields and refs, and the gate is done", async () => {
    const h = harness();
    await designDone(h);
    const result = await expand(h, typed("bdk:plan"));
    expect(result.code).toBe(0);
    const report = promptExpansionOutput.parse(result.json);
    expect(report).toMatchObject({
      decision: "pass",
      command: "plan",
      stage: "plan",
      gate: "gate:design",
      wrote: "transition:user",
      status: { gate: "gate:design", done: true, passedBy: "user" },
    });
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({
        source: "user",
        gate: "gate:design",
        to: "plan",
        at: T1,
        session: "sess-1",
        command: "/bdk:plan",
        refs: ["gate:design", "design", "architecture", "design-verify"],
      }),
    ]);
    const next = (await h.run(["next", "--json"], "", T1)).json as { gates: unknown[] };
    expect(next.gates[0]).toMatchObject({ gate: "gate:design", done: true, passedBy: "user" });
  });

  it("passes the gate only on the payload, never on a log entry naming it", async () => {
    const h = harness();
    await designDone(h);
    const logged = await h.run([
      "log",
      "add",
      "decision",
      "Design approved",
      "--ref",
      "gate:design",
    ]);
    expect(logged.code).toBe(0);
    const before = (await h.run(["next", "--json"])).json as { gates: unknown[] };
    expect(before.gates[0]).toMatchObject({ gate: "gate:design", done: false });
    await expand(h, typed("bdk:plan"));
    const after = (await h.run(["next", "--json"])).json as { gates: unknown[] };
    expect(after.gates[0]).toMatchObject({ gate: "gate:design", done: true, passedBy: "user" });
  });

  it("prints the gate status as plain text without --json", async () => {
    const h = harness();
    await designDone(h);
    const result = await h.run(["hooks", "prompt-expansion"], typed("bdk:plan"));
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(
      /^\[BDK\] gate:design passed by the user in L-[0-9a-z]{8}; stage plan is open\.\n$/,
    );
  });

  it("blocks a gate that is not ready, naming the missing requirement, and writes nothing", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    await h.run(["done", "design"], "", T0);
    const result = await expand(h, typed("bdk:plan"));
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/gate-not-ready",
      why: "gate:design is not ready for /bdk:plan: architecture is ready, design-verify is blocked",
    });
    expect(transitions(h.store)).toStrictEqual([]);
  });

  it("passes a gate already done without writing", async () => {
    const h = harness();
    await designDone(h);
    passGate(h.store, "gate:design", "plan", T1);
    const result = await expand(h, typed("bdk:plan"), T2);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      wrote: "none",
      status: { done: true, passedBy: "user" },
      passedAt: T1,
    });
    expect(transitions(h.store)).toHaveLength(1);
    const text = await h.run(["hooks", "prompt-expansion"], typed("bdk:plan"), T2);
    expect(text.stdout).toBe(
      `[BDK] gate:design was already passed by user at ${T1}; nothing was written.\n`,
    );
  });

  it("writes a plain transition for tiny, which has no design gate", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    const result = await expand(h, typed("bdk:plan"));
    expect(result.json).toMatchObject({ stage: "plan", wrote: "transition:stage" });
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({ source: "kernel", to: "plan", session: "sess-1" }),
    ]);
  });

  it("writes skip-verify once for /bdk:execute --skip-verify", async () => {
    const h = harness();
    const first = await expand(h, typed("bdk:execute", "--skip-verify"));
    expect(first.json).toMatchObject({ wrote: "transition:stage", skipVerify: true });
    const second = await expand(h, typed("bdk:execute", "--skip-verify"), T2);
    expect(second.json).toMatchObject({ wrote: "none", skipVerify: true });
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({
        to: "execute",
        source: "kernel",
        "skip-verify": true,
        command: "/bdk:execute --skip-verify",
      }),
    ]);
    const third = await expand(h, typed("bdk:execute"), T2);
    expect(third.json).toMatchObject({ wrote: "transition:stage", skipVerify: false });
  });

  it("reads --skip-verify only as an exact token", async () => {
    const h = harness();
    const result = await expand(h, typed("bdk:execute", "--skip-verifying"));
    expect(result.json).toMatchObject({ skipVerify: false });
  });

  it("passes a ready auto gate by policy under /bdk:run", async () => {
    const h = harness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "policy:\n  gates:\n    design: auto\n");
    await designDone(h);
    const result = await expand(h, typed("bdk:run"));
    expect(result.json).toMatchObject({
      command: "run",
      wrote: "transition:policy",
      passed: [{ gate: "gate:design", stage: "plan" }],
      waiting: [],
    });
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({ source: "policy", gate: "gate:design", to: "plan" }),
    ]);
    const next = (await h.run(["next", "--json"], "", T1)).json as { gates: unknown[] };
    expect(next.gates[0]).toMatchObject({ done: true, passedBy: "policy" });
  });

  it("leaves a manual gate under /bdk:run and names the command the user types", async () => {
    const h = harness();
    await designDone(h);
    const result = await expand(h, typed("bdk:run"));
    expect(result.json).toMatchObject({
      wrote: "none",
      passed: [],
      waiting: [{ gate: "gate:design", command: "/bdk:plan" }],
    });
    expect(transitions(h.store)).toStrictEqual([]);
    const text = await h.run(["hooks", "prompt-expansion"], typed("bdk:run"));
    expect(text.stdout).toBe("[BDK] gate:design is ready; the user types /bdk:plan to pass it.\n");
  });

  it("blocks a stage command without an active Change", async () => {
    const h = harness(withPluginFiles(memoryStore()));
    const result = await expand(h, typed("bdk:plan"));
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/no-active-change" });
    expect((result.json as { instead: string[] }).instead).toContain('/bdk:change new "<intent>"');
  });

  it.each([
    ["the recorded /bdk:mermaid-drawer", JSON.stringify(upeTyped.payloads[1])],
    ["a skill of another plugin", typed("caveman:commit")],
  ])("passes %s without a Change and without writing", async (_, payload) => {
    const h = harness(withPluginFiles(memoryStore()));
    const result = await h.run(["hooks", "prompt-expansion"], payload);
    expect(result).toMatchObject({ code: 0, stdout: "" });
  });

  it.each([
    ["expansion_type", { expansion_type: undefined }, "expansion_type slash_command"],
    ["session_id", { session_id: undefined }, "session_id"],
    [
      "hook_event_name",
      { hook_event_name: "UserPromptSubmit" },
      "hook_event_name UserPromptExpansion",
    ],
  ])("blocks a stage command whose payload lacks %s", async (_, fields, named) => {
    const h = harness();
    await designDone(h);
    const result = await expand(h, typed("bdk:plan", "", fields));
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "input/invalid-argument",
      why: `the UserPromptExpansion payload has no ${named}; no transition was written`,
    });
    expect(transitions(h.store)).toStrictEqual([]);
  });

  it("blocks a payload without command_name", async () => {
    const h = harness();
    const result = await expand(h, typed("bdk:plan", "", { command_name: undefined }));
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
  });

  it("reads command_input when command_args is absent", async () => {
    const h = harness();
    const payload = typed("bdk:execute", "", {
      command_args: undefined,
      command_input: "--skip-verify",
    });
    expect((await expand(h, payload)).json).toMatchObject({ skipVerify: true });
  });
});
