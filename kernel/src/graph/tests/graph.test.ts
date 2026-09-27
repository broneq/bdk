// The graph commands through the real registry on an in-memory repository
// (`kernel-cli/graph`; `kernel-pipeline`, Instruction and Gate), plus the
// graph's settings (`kernel-settings`, policy.gates and pipeline/<kind>).
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { mergeLayers, resolveConfig, validateLayers } from "../../shared/config/index.ts";
import type { Layer } from "../../shared/config/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { KIND_NAMES, pipelinePrompts, policyModule } from "../config.ts";
import { graphConfig } from "../index.ts";
import { doneOutput, explainOutput, nextOutput, validateOutput } from "../schema/outputs.ts";
import {
  DIR,
  harness,
  passGate,
  PLUGIN,
  ROOT,
  setChange,
  writeDesign,
  writeDesignPart,
  writeEntry,
  writePlanPart,
} from "./support.ts";
import type { Harness } from "./support.ts";

/** `expect.stringContaining` typed for a `toMatchObject` literal. */
const containing = (text: string): unknown => expect.stringContaining(text);

const T0 = "2026-09-25T10:00:00Z";
const T1 = "2026-09-25T10:05:00Z";
const T2 = "2026-09-25T10:10:00Z";
const T3 = "2026-09-25T10:15:00Z";

function ledger(store: Store): Record<string, unknown>[] {
  return store.list(`${DIR}/log`).map((name) => {
    const document = readDocument(store, `${DIR}/log/${name}`);
    if (document === undefined || !("data" in document)) throw new Error(name);
    return document.data;
  });
}

/** design and architecture done at T0, gate:design passed by the user at T1. */
async function pastDesignGate(h: Harness): Promise<void> {
  writeDesign(h.store, "design");
  writeDesign(h.store, "architecture");
  await h.run(["done", "design"], T0);
  await h.run(["done", "architecture"], T0);
  passGate(h.store, "gate:design", "plan", T1);
}

describe("settings", () => {
  const registry = settingsRegistry();
  const check = (values: Record<string, unknown>) => {
    const layers: Layer[] = [{ name: "project", path: "/p.yaml", text: "", values }];
    return validateLayers(registry, layers, mergeLayers(layers));
  };

  it("policy.gates resolve to manual by default and accept auto", () => {
    expect(check({}).value?.policy).toStrictEqual({
      gates: { design: "manual", review: "manual" },
    });
    expect(check({ policy: { gates: { design: "auto" } } }).value?.policy).toStrictEqual({
      gates: { design: "auto", review: "manual" },
    });
    expect(check({ policy: { gates: { design: "maybe" } } }).problems[0]?.rule).toBe(
      "policy/config-invalid",
    );
  });

  it("policy.budgets still lands with T22", () => {
    expect(check({ policy: { budgets: { verifier: 3 } } }).problems).toStrictEqual([
      expect.objectContaining({
        rule: "policy/unknown-config-key",
        key: "policy.budgets.verifier",
        message: "lands with T22",
      }),
    ]);
  });

  it("declares one literal pipeline/<kind> key per kind with its plugin default", () => {
    expect(pipelinePrompts.map((prompt) => [prompt.key, prompt.defaultFile])).toStrictEqual(
      KIND_NAMES.map((kind) => [`pipeline/${kind}`, `pipeline/${kind}.md`]),
    );
    expect(graphConfig).toStrictEqual({ modules: [policyModule], prompts: pipelinePrompts });
  });

  it("a prompt file for a name that is no kind is an unknown key", () => {
    const store = harness().store;
    const resolve = () =>
      resolveConfig({
        store,
        registry,
        globalDir: "/home/dev/.config/bdk",
        projectRoot: ROOT,
        pluginRoot: PLUGIN,
      }).problems.map((problem) => [problem.rule, problem.key]);
    expect(resolve()).toStrictEqual([]);
    store.write(`${ROOT}/.bdk/prompts/pipeline/desing.md`, "Typo.\n");
    expect(resolve()).toContainEqual(["policy/unknown-config-key", "prompts.pipeline/desing"]);
  });
});

describe("bdk next", () => {
  it("a new small Change asks for the design", async () => {
    const h = harness();
    const result = await h.run(["next", "--json"]);
    expect(result.code).toBe(0);
    const report = nextOutput.parse(result.json);
    expect(report.artifact).toMatchObject({ id: "design", kind: "design", state: "ready" });
    expect(report.stage).toBe("intent");
    expect(report.instruction).toContain("Run `bdk done design`.");
  });

  it("builds the instruction skeleton, byte-identical on a second run", async () => {
    const h = harness();
    const first = await h.run(["next"]);
    expect((await h.run(["next"])).stdout).toBe(first.stdout);
    const sections = first.stdout.split("\n").filter((line) => line.startsWith("#"));
    expect(sections).toStrictEqual([
      "# design (design)",
      "## Write to",
      "## Rules",
      "## Ledger",
      "## When finished",
    ]);
    expect(first.stdout).toContain(`- .bdk/changes/2026-09-25-login/design.md`);
    expect(first.stdout).toContain("Write the design of Change 2026-09-25-login (profile small)");
    expect(first.stdout).not.toMatch(/\{(change|node|profile|paths)\}/);
  });

  it("appends a project template with mode extends", async () => {
    const h = harness();
    h.store.write(`${ROOT}/.bdk/prompts/pipeline/design.md`, "Also name the rollback plan.\n");
    const text = (await h.run(["next"])).stdout;
    expect(text.indexOf("Also name the rollback plan.")).toBeGreaterThan(
      text.indexOf("Write the design of Change"),
    );
  });

  it("carries the node's rule sets and caps the ledger at 20", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    for (let i = 0; i < 35; i++) {
      writeEntry(h.store, {
        type: "decision",
        at: `2026-09-25T09:${String(i).padStart(2, "0")}:00Z`,
        summary: `Decision ${i}`,
      });
    }
    const text = (await h.run(["next"])).stdout;
    expect(text).toContain("### code-quality");
    expect(text).toContain("### test-quality");
    const ledger = text.slice(text.indexOf("## Ledger"), text.indexOf("## When finished"));
    expect(ledger.match(/^- L-/gm)).toHaveLength(20);
    expect(ledger).toContain("Decision 34");
    expect(ledger).not.toContain("Decision 14\n");
    expect(ledger).toContain("- 15 more: bdk log list");
    expect(text).toContain("Run `bdk done plan` to mark every part");
  });

  it("waits at the design gate with its command and pending review entries", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    writeEntry(h.store, {
      type: "question",
      at: T1,
      review: true,
      summary: "WebAuthn?",
      status: "proposed",
    });
    const report = nextOutput.parse((await h.run(["next", "--json"], T1)).json);
    expect(report.artifact).toBeUndefined();
    expect(report.waiting).toBe("gate");
    expect(report.gates[0]).toMatchObject({
      gate: "gate:design",
      ready: true,
      done: false,
      command: "/bdk:plan",
      pending: [expect.objectContaining({ summary: "WebAuthn?", review: true })],
    });
    const text = (await h.run(["next"], T1)).stdout;
    expect(text).toContain("# Waiting for gate:design");
    expect(text).toContain("`/bdk:plan`");
    expect(text).toContain("WebAuthn?");
    expect(text).toContain("Gate gate:design of Change 2026-09-25-login waits");
  });

  it("a faked approval does not open the gate; a user transition does", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    await h.run(["log", "add", "decision", "Design approved", "--ref", "gate:design"], T1);
    expect(nextOutput.parse((await h.run(["next", "--json"], T1)).json).waiting).toBe("gate");
    passGate(h.store, "gate:design", "plan", T1);
    const report = nextOutput.parse((await h.run(["next", "--json"], T1)).json);
    expect(report.artifact?.id).toBe("plan");
    expect(report.stage).toBe("plan");
    expect(report.gates[0]).toMatchObject({ done: true, passedBy: "user" });
  });

  it("a loop-back needs a newer user entry", async () => {
    const h = harness();
    await pastDesignGate(h);
    writeDesign(h.store, "design", "Changed.\n");
    expect((await h.run(["done", "design", "--json"], T2)).code).toBe(0);
    expect(nextOutput.parse((await h.run(["next", "--json"], T2)).json).waiting).toBe("gate");
    passGate(h.store, "gate:design", "plan", T3);
    expect(nextOutput.parse((await h.run(["next", "--json"], T3)).json).artifact?.id).toBe("plan");
  });

  it("an auto gate passes with a policy entry, a manual one does not", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    passGate(h.store, "gate:design", "plan", T1, "policy");
    expect(nextOutput.parse((await h.run(["next", "--json"], T1)).json).waiting).toBe("gate");
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "policy:\n  gates:\n    design: auto\n");
    const report = nextOutput.parse((await h.run(["next", "--json"], T1)).json);
    expect(report.gates[0]).toMatchObject({ done: true, passedBy: "policy" });
  });

  it("a parked Change waits for the user", async () => {
    const h = harness();
    await h.run(["change", "park", "--option", "accept as debt", "--option", "split part 02"]);
    const report = nextOutput.parse((await h.run(["next", "--json"])).json);
    expect(report.waiting).toBe("user");
    expect(report.artifact).toBeUndefined();
    const text = (await h.run(["next"])).stdout;
    expect(text).toContain("bdk change resume 2026-09-25-login --option <n>");
    expect(text).toContain("1. accept as debt");
  });

  it("says nothing waits when every node is done", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    writePlanPart(h.store, "01");
    await h.run(["done", "plan"], T0);
    writeEntry(h.store, { type: "transition", source: "kernel", to: "execute-part:01", at: T0 });
    writeEntry(h.store, {
      type: "transition",
      source: "kernel",
      to: "review",
      at: T0,
      "input-hash": `sha256:${"a".repeat(64)}`,
    });
    const text = (await h.run(["next"], T1)).stdout;
    // review is stale against the fake git's empty tree, so it is next
    expect(text).toContain("# review (review)");
  });

  it("answers a refusal as a STOP block with exit 0", async () => {
    const h = harness();
    h.git.branch = "other";
    const result = await h.run(["next"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("BDK STOP: no active Change on branch other");
  });
});

describe("bdk explain", () => {
  it("prints the chain of plan-verify, each node once, latest first", async () => {
    const h = harness();
    await pastDesignGate(h);
    writePlanPart(h.store, "01");
    writePlanPart(h.store, "02");
    await h.run(["done", "plan-part:01"], T2);
    const result = await h.run(["explain", "plan-verify", "--json"], T2);
    expect(result.code).toBe(0);
    const report = explainOutput.parse(result.json);
    expect(report.chain.map((node) => [node.id, node.state])).toStrictEqual([
      ["plan-verify", "blocked"],
      ["plan-part:01", "done"],
      ["plan-part:02", "ready"],
      ["gate:design", "done"],
      ["architecture", "done"],
      ["design", "done"],
      ["intent", "done"],
    ]);
    expect(report.chain[0]?.why).toBe("plan-part:02 is ready, not done");
    expect(report.chain[3]?.why).toContain("passed by user");
    const text = (await h.run(["explain", "plan-verify"], T2)).stdout;
    expect(text).toContain("plan-verify: blocked (profile small)");
  });

  it("names both hashes of a stale node", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    await h.run(["done", "design"], T0);
    writeDesign(h.store, "design", "Edited.\n");
    const report = explainOutput.parse((await h.run(["explain", "design", "--json"], T1)).json);
    expect(report.state).toBe("stale");
    expect(report.chain[0]?.why).toMatch(
      /^inputs changed: recorded sha256:[0-9a-f]{64}, current sha256:[0-9a-f]{64}$/,
    );
    expect((await h.run(["next", "--json"], T1)).json).toMatchObject({
      artifact: { id: "design", state: "stale" },
    });
  });

  it("answers a node outside the variant as skipped", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    const report = explainOutput.parse((await h.run(["explain", "design", "--json"])).json);
    expect(report).toMatchObject({
      state: "skipped",
      chain: [{ id: "design", why: containing("profile tiny") }],
    });
  });

  it("reports the if conditions that applied", async () => {
    const h = harness();
    const text = h.store.read(`${PLUGIN}/pipeline/pipeline.yaml`) ?? "";
    h.store.write(
      `${PLUGIN}/pipeline/pipeline.yaml`,
      text.replace("    profiles: [small]\n", "    profiles: [small]\n    if: features.lavish\n"),
    );
    const report = explainOutput.parse((await h.run(["explain", "architecture", "--json"])).json);
    expect(report.conditions).toStrictEqual(["features.lavish"]);
  });

  it("refuses an unknown node with input/not-found", async () => {
    const result = await harness().run(["explain", "plan-verfy", "--json"]);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({
      rule: "input/not-found",
      instead: ["bdk explain plan-verify", "bdk change status"],
    });
  });
});

describe("bdk validate", () => {
  it("validates the artifact next returns and writes nothing", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    const before = h.store.list(`${DIR}/log`);
    const report = validateOutput.parse((await h.run(["validate", "--json"])).json);
    expect(report).toMatchObject({ artifact: "design", valid: true });
    expect(report.inputHash).toMatch(/^sha256:/);
    expect(h.store.list(`${DIR}/log`)).toStrictEqual(before);
  });

  it("answers valid: false under --json and exit 2 in text mode", async () => {
    const h = harness();
    const json = await h.run(["validate", "design", "--json"]);
    expect(json.code).toBe(0);
    expect(validateOutput.parse(json.json)).toMatchObject({
      valid: false,
      checks: [{ id: "exists", ok: false }],
    });
    const text = await h.run(["validate", "design"]);
    expect(text.code).toBe(2);
    expect(text.stdout).toContain("policy/validation-failed");
    expect(text.stdout).toContain("FAIL exists");
  });

  it("validates every instance of a collection", async () => {
    const h = harness();
    writePlanPart(h.store, "01");
    writePlanPart(h.store, "02");
    const report = validateOutput.parse((await h.run(["validate", "plan", "--json"])).json);
    expect(report.checks.map((check) => check.id)).toContain("plan-part:02:schema");
  });

  it("refuses input/not-found when nothing is actionable or the node is unknown", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    const waiting = await h.run(["validate", "--json"], T1);
    expect(waiting.code).toBe(3);
    expect(waiting.json).toMatchObject({
      rule: "input/not-found",
      why: containing("waits for gate:design"),
    });
    expect((await h.run(["validate", "nope", "--json"])).code).toBe(3);
    await h.run(["change", "park"]);
    expect((await h.run(["validate", "--json"])).json).toMatchObject({ why: containing("parked") });
  });
});

describe("bdk done", () => {
  it("records the hash in a kernel transition and is idempotent", async () => {
    const h = harness();
    writeDesign(h.store, "design");
    const result = await h.run(["done", "design", "--json"], T0);
    expect(result.code).toBe(0);
    const report = doneOutput.parse(result.json);
    expect(report).toMatchObject({ artifact: "design", state: "done", next: "architecture" });
    const written = ledger(h.store).filter((entry) => entry.type === "transition");
    expect(written).toStrictEqual([
      expect.objectContaining({
        to: "design",
        source: "kernel",
        status: "accepted",
        refs: ["design", "design.md"],
        "input-hash": report.inputHash,
        id: report.entry,
      }),
    ]);
    const again = doneOutput.parse((await h.run(["done", "design", "--json"], T1)).json);
    expect(again).toStrictEqual(report);
    expect(ledger(h.store).filter((entry) => entry.type === "transition")).toHaveLength(1);
    expect((await h.run(["done", "design"], T1)).stdout).toContain("design done in");
  });

  it("refuses policy/not-ready naming the open requirement", async () => {
    const result = await harness().run(["done", "architecture", "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/not-ready",
      why: "architecture: design is ready, not done",
      instead: ["bdk explain architecture", "bdk done design"],
    });
  });

  it("refuses policy/validation-failed with the failing check", async () => {
    const h = harness();
    writeDesign(h.store, "design", `${"x".repeat(12_300)}\n`);
    const result = await h.run(["done", "design", "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/validation-failed",
      why: containing("check size"),
    });
    expect((result.json as { instead: string[] }).instead[0]).toContain("design/parts/");
  });

  it("refuses policy/gate-not-ready on a gate", async () => {
    const result = await harness().run(["done", "gate:design", "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/gate-not-ready",
      instead: ["/bdk:plan", "bdk explain gate:design"],
    });
  });

  it.each([
    ["intent", "bdk next"],
    ["execute-part:01", "bdk part done 01"],
    ["close", "bdk change close"],
  ])("refuses policy/invalid-transition on %s, done by another command", async (id, instead) => {
    const h = harness();
    writePlanPart(h.store, "01");
    const result = await h.run(["done", id, "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition", instead: [instead] });
  });

  it("refuses policy/invalid-transition on a skipped node and input/not-found on an unknown one", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    expect((await h.run(["done", "design", "--json"])).json).toMatchObject({
      rule: "policy/invalid-transition",
    });
    expect((await h.run(["done", "plan-part:09", "--json"])).code).toBe(3);
  });

  it("marks every ready plan part, regenerates the plan index and stops at the first failure", async () => {
    const h = harness();
    await pastDesignGate(h);
    writePlanPart(h.store, "01");
    writePlanPart(h.store, "02", { dependsOn: ["01"] });
    h.store.write(`${DIR}/plan/parts/03-bad.md`, '---\nschema: 1\nid: "03"\n---\n');
    const failed = await h.run(["done", "plan", "--json"], T2);
    expect(failed.json).toMatchObject({
      rule: "policy/validation-failed",
      why: containing("plan-part:03"),
    });
    expect(
      ledger(h.store).filter((entry) => String(entry.to).startsWith("plan-part")),
    ).toHaveLength(0);
    h.store.remove(`${DIR}/plan/parts/03-bad.md`);
    const report = doneOutput.parse((await h.run(["done", "plan", "--json"], T2)).json);
    expect(report).toMatchObject({ artifact: "plan", next: "plan-verify" });
    expect(
      ledger(h.store)
        .filter((entry) => String(entry.to).startsWith("plan-part"))
        .map((entry) => entry.to),
    ).toStrictEqual(["plan-part:01", "plan-part:02"]);
    expect(h.store.read(`${DIR}/plan/index.md`)).toContain("| 02 | Part 02 | 01 | 2 |");
    const again = doneOutput.parse((await h.run(["done", "plan", "--json"], T3)).json);
    expect(again.inputHash).toBe(report.inputHash);
  });

  it("marks one plan part without the index until the plan is complete", async () => {
    const h = harness();
    await pastDesignGate(h);
    writePlanPart(h.store, "01");
    writePlanPart(h.store, "02");
    expect(doneOutput.parse((await h.run(["done", "plan-part:01", "--json"], T2)).json).next).toBe(
      "plan-part:02",
    );
    expect(h.store.read(`${DIR}/plan/index.md`)).toBeUndefined();
    await h.run(["done", "plan-part:02"], T2);
    expect(h.store.read(`${DIR}/plan/index.md`)).toBeDefined();
  });

  it("refuses a collection with nothing ready", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    const result = await h.run(["done", "plan", "--json"]);
    expect(result.json).toMatchObject({ rule: "policy/validation-failed" });
  });

  it("regenerates design/index.md on design-index", async () => {
    const h = harness();
    setChange(h.store, { profile: "large" });
    writeDesignPart(h.store, "01");
    writeDesignPart(h.store, "02");
    await h.run(["done", "design-parts"], T0);
    const report = doneOutput.parse((await h.run(["done", "design-index", "--json"], T1)).json);
    expect(report.next).toBe("architecture");
    expect(h.store.read(`${DIR}/design/index.md`)).toContain("| 02 | Part 02 | - |");
  });

  it("raises a split small design to large", async () => {
    const h = harness();
    writeDesignPart(h.store, "01");
    writeDesignPart(h.store, "02");
    const report = doneOutput.parse((await h.run(["done", "design", "--json"])).json);
    expect(report).toMatchObject({ artifact: "design", next: "design-part:01" });
    expect(ledger(h.store)).toContainEqual(
      expect.objectContaining({
        type: "decision",
        profile: "large",
        source: "kernel",
        refs: ["design/parts/"],
        id: report.entry,
      }),
    );
    expect((await h.run(["change", "status", "--json"])).json).toMatchObject({ profile: "large" });
  });

  it("marks plan-verify done after a passing report", async () => {
    const h = harness();
    await pastDesignGate(h);
    writePlanPart(h.store, "01");
    await h.run(["done", "plan"], T2);
    const missing = await h.run(["done", "plan-verify", "--json"], T2);
    expect(missing.json).toMatchObject({
      rule: "policy/validation-failed",
      why: containing("no report entry names plan-verify"),
    });
    h.store.write(
      `${DIR}/reports/plan-verify-plan-verifier-A-00000001.md`,
      "---\nschema: 1\nticket: A-00000001\nrole: plan-verifier\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n",
    );
    writeEntry(h.store, {
      type: "report",
      at: T2,
      source: "agent:plan-verifier",
      refs: ["plan-verify"],
      report: "reports/plan-verify-plan-verifier-A-00000001.md",
    });
    const report = doneOutput.parse((await h.run(["done", "plan-verify", "--json"], T3)).json);
    expect(report.next).toBe("execute-part:01");
  });
});
