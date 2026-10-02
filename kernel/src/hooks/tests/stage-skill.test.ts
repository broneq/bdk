// The stage-skill guard of `hooks pre-tool` (`kernel-cli/hooks`, Pre-tool
// guards, Stage skill; T41 design D1 to D3) through the registry on a memory
// repository, driven by the recorded `pre-skill.json` payload (2.1.287) and
// the recorded typed `/bdk:run`.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import preSkill from "../../../../tests/fixtures/host-payloads/2.1.287/pre-skill.json" with { type: "json" };
import upeTyped from "../../../../tests/fixtures/host-payloads/2.1.281/upe-typed.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import { graphRegistrations } from "../../graph/index.ts";
import { withPluginFiles, writeDesign, writeDesignVerdict } from "../../graph/tests/support.ts";
import { logRegistrations } from "../../log/index.ts";
import {
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  sequentialRandom,
} from "../../log/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import {
  memoryIndex,
  memoryRegistry,
  readDocument,
  readRunMarker,
  runMarkerPath,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { hooksRegistrations } from "../index.ts";
import type { HooksDeps } from "../index.ts";

const T0 = "2026-10-02T10:00:00.000Z";
const T1 = "2026-10-02T10:05:00.000Z";
const SESSION = "sess-1";

interface Harness {
  readonly store: Store;
  run(argv: readonly string[], stdin?: string): Promise<RunResult>;
}

function harness(): Harness {
  const store = withPluginFiles(repository());
  const git = fakeGit();
  const random = sequentialRandom();
  return {
    store,
    run: (argv, stdin = "") => {
      const deps: HooksDeps = {
        store,
        git,
        openIndex: memoryIndex,
        openRegistry: memoryRegistry(),
        clock: fixedClock(argv[0] === "hooks" ? T1 : T0),
        random,
        pluginRoot: "/plugins/bdk",
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

/** The recorded `Skill` call, for `skill` in `session`, from a subagent when `agent` is set. */
function skillCall(skill: string, fields: Record<string, unknown> = {}): string {
  const recorded = preSkill.payloads.find(
    (payload) => (payload as { tool_name?: string }).tool_name === "Skill",
  ) as Record<string, unknown>;
  return JSON.stringify({
    ...recorded,
    cwd: ROOT,
    session_id: SESSION,
    tool_input: { skill, args: "" },
    ...fields,
  });
}

function typedRun(args = ""): string {
  return JSON.stringify({
    ...(upeTyped.payloads[0] as Record<string, unknown>),
    session_id: SESSION,
    command_name: "bdk:run",
    command_args: args,
    prompt: `/bdk:run${args === "" ? "" : ` ${args}`}`,
  });
}

const call = (h: Harness, skill: string, fields?: Record<string, unknown>) =>
  h.run(["hooks", "pre-tool", "--json"], skillCall(skill, fields));

const startRun = (h: Harness, args = "") =>
  h.run(["hooks", "prompt-expansion", "--json"], typedRun(args));

async function designDone(h: Harness): Promise<void> {
  writeDesign(h.store, "design");
  writeDesign(h.store, "architecture");
  await h.run(["done", "design"]);
  await h.run(["done", "architecture"]);
  writeDesignVerdict(h.store, T0);
  await h.run(["done", "design-verify"]);
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

function autoDesign(store: Store): void {
  store.write(`${ROOT}/.bdk/settings.yaml`, "policy:\n  gates:\n    design: auto\n");
}

describe("hooks pre-tool: stage skills", () => {
  it("denies a stage skill outside a run, naming its command, and writes nothing", async () => {
    const h = harness();
    const result = await call(h, "bdk:execute");
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "guard/stage-skill",
      why: "/bdk:execute is started by the user, or by /bdk:run for its session; ask the user to type /bdk:execute (BDK T41)",
    });
    expect(transitions(h.store)).toStrictEqual([]);
  });

  it("denies a stage skill from a subagent, even inside a run", async () => {
    const h = harness();
    await designDone(h);
    autoDesign(h.store);
    await startRun(h);
    const result = await call(h, "bdk:plan", { agent_id: "a1b2c3", agent_type: "bdk:worker" });
    expect(result.json).toMatchObject({ rule: "guard/stage-skill" });
  });

  it("admits the run's first bdk:change and denies a second one", async () => {
    const h = harness();
    await startRun(h);
    expect((await call(h, "bdk:change")).code).toBe(0);
    expect(readRunMarker(h.store, ROOT, SESSION)).toMatchObject({ "change-started": true });
    expect(transitions(h.store)).toStrictEqual([]);
    expect((await call(h, "bdk:change")).json).toMatchObject({ rule: "guard/stage-skill" });
  });

  it("denies a stage skill of another session's run", async () => {
    const h = harness();
    await startRun(h);
    const result = await call(h, "bdk:execute", { session_id: "sess-2" });
    expect(result.json).toMatchObject({ rule: "guard/stage-skill" });
  });

  it.each(["bdk:design", "bdk:verify-design", "bdk:verify-plan", "bdk:cr", "caveman:commit"])(
    "passes %s without a run and writes nothing",
    async (skill) => {
      const h = harness();
      expect((await call(h, skill)).code).toBe(0);
      expect(transitions(h.store)).toStrictEqual([]);
    },
  );

  it("passes an auto gate that became ready during the run, by policy with the run's prompt", async () => {
    const h = harness();
    autoDesign(h.store);
    await startRun(h);
    expect(transitions(h.store)).toStrictEqual([]);
    await designDone(h);
    const result = await call(h, "bdk:plan");
    expect(result.code).toBe(0);
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({
        source: "policy",
        gate: "gate:design",
        to: "plan",
        command: "/bdk:run",
        session: SESSION,
        at: T1,
      }),
    ]);
    const next = (await h.run(["next", "--json"])).json as { gates: unknown[] };
    expect(next.gates[0]).toMatchObject({ gate: "gate:design", done: true, passedBy: "policy" });
  });

  it("denies a ready manual gate in a run without --auto, naming the command", async () => {
    const h = harness();
    await startRun(h);
    await designDone(h);
    const result = await call(h, "bdk:plan");
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "guard/gate-manual",
      why: "gate:design is manual and this run has no --auto; stop the run and ask the user to type /bdk:plan (BDK T41, R-9)",
    });
    expect(transitions(h.store)).toStrictEqual([]);
  });

  it("passes a ready manual gate in a run with --auto", async () => {
    const h = harness();
    await startRun(h, "--auto");
    await designDone(h);
    expect((await call(h, "bdk:plan")).code).toBe(0);
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({
        source: "policy",
        gate: "gate:design",
        command: "/bdk:run --auto",
        auto: true,
      }),
    ]);
    const next = (await h.run(["next", "--json"])).json as { gates: unknown[] };
    expect(next.gates[0]).toMatchObject({ gate: "gate:design", done: true, passedBy: "policy" });
  });

  it("denies a gate that is not ready as a typed command would", async () => {
    const h = harness();
    autoDesign(h.store);
    await startRun(h);
    const result = await call(h, "bdk:plan");
    expect(result.json).toMatchObject({ rule: "policy/gate-not-ready" });
    expect((result.json as { why: string }).why).toContain("design is");
  });

  it("passes a gate already done without writing", async () => {
    const h = harness();
    autoDesign(h.store);
    await designDone(h);
    await startRun(h);
    expect(transitions(h.store)).toHaveLength(1);
    expect((await call(h, "bdk:plan")).code).toBe(0);
    expect(transitions(h.store)).toHaveLength(1);
  });

  it("writes the plain stage transition of bdk:execute once", async () => {
    const h = harness();
    await startRun(h);
    await call(h, "bdk:execute");
    await call(h, "bdk:execute");
    expect(transitions(h.store)).toStrictEqual([
      expect.objectContaining({ source: "kernel", to: "execute", command: "/bdk:run" }),
    ]);
  });

  it("denies when the marker does not parse", async () => {
    const h = harness();
    h.store.write(runMarkerPath(ROOT, SESSION), "{");
    expect((await call(h, "bdk:execute")).json).toMatchObject({ rule: "guard/stage-skill" });
  });

  it("prints the host's deny object on a block", async () => {
    const h = harness();
    const result = await h.run(["hooks", "pre-tool"], skillCall("bdk:close"));
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
    expect(result.stdout).toContain("guard/stage-skill: /bdk:close is started by the user");
  });
});
