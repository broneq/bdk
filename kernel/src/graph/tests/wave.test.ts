// The execute wave in `bdk next` (`kernel-cli/graph`, bdk next; T41-D3): the
// ready parts, whether each is started, its open tickets and its mode.
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { mergeLayers, moduleValue, validateLayers } from "../../shared/config/index.ts";
import type { Layer } from "../../shared/config/index.ts";
import { writeDocument } from "../../shared/store/index.ts";
import { executionTreeModule } from "../config.ts";
import { nextOutput } from "../schema/outputs.ts";
import {
  DIR,
  ROOT,
  harness,
  passGate,
  setChange,
  writeDesign,
  writeDesignPart,
  writeDesignVerdict,
  writeEntry,
  writePlanPart,
} from "./support.ts";
import type { Harness } from "./support.ts";

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T10:05:00.000Z";
const T2 = "2026-09-25T10:10:00.000Z";
const T3 = "2026-09-25T10:15:00.000Z";

async function ok(h: Harness, argv: readonly string[], at: string): Promise<void> {
  const result = await h.run([...argv, "--json"], at);
  if (result.code !== 0) throw new Error(`${argv.join(" ")}: ${JSON.stringify(result.json)}`);
}

/**
 * A Change of `profile` with parts 01 and 02 done in `plan` and, unless tiny
 * or `verified` is false, `plan-verify`.
 */
async function planned(
  profile: "tiny" | "small" | "large",
  dependsOn: Readonly<Record<string, readonly string[]>> = {},
  verified = true,
  bodies: Readonly<Record<string, string>> = {},
): Promise<Harness> {
  const h = harness();
  setChange(h.store, { profile });
  if (profile === "large") {
    writeDesignPart(h.store, "01");
    writeDesignPart(h.store, "02");
    await ok(h, ["done", "design-parts"], T0);
    await ok(h, ["done", "design-index"], T0);
    writeDesign(h.store, "architecture");
    await ok(h, ["done", "architecture"], T0);
  } else if (profile === "small") {
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await ok(h, ["done", "design"], T0);
    await ok(h, ["done", "architecture"], T0);
  }
  if (profile !== "tiny") {
    writeDesignVerdict(h.store, T0);
    await ok(h, ["done", "design-verify"], T0);
    passGate(h.store, "gate:design", "plan", T1);
  }
  for (const nn of ["01", "02", "03"]) {
    if (nn === "03" && dependsOn["03"] === undefined) continue;
    writePlanPart(h.store, nn, {
      dependsOn: dependsOn[nn] ?? [],
      ...(bodies[nn] === undefined ? {} : { body: bodies[nn] }),
    });
  }
  await ok(h, ["done", "plan"], T2);
  if (profile !== "tiny" && verified) {
    h.store.write(
      `${DIR}/reports/plan-verify-verifier-A-00000001.md`,
      "---\nschema: 1\nticket: A-00000001\nrole: verifier\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n",
    );
    writeEntry(h.store, {
      type: "report",
      at: T2,
      source: "agent:verifier",
      refs: ["plan-verify"],
      report: "reports/plan-verify-verifier-A-00000001.md",
    });
    await ok(h, ["done", "plan-verify"], T3);
  }
  return h;
}

function openTicket(h: Harness, ticket: string, loop: string, target: string): void {
  writeDocument(h.store, `${DIR}/attempts/${loop}-${target}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop,
      target,
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": T3,
      author: "Ada Lovelace <ada@example.com>",
    },
    body: "",
  });
}

function start(h: Harness, nn: string): void {
  writeEntry(h.store, { type: "transition", source: "kernel", to: `execute-part:${nn}`, at: T3 });
}

async function next(h: Harness) {
  return nextOutput.parse((await h.run(["next", "--json"], T3)).json);
}

describe("execution.tree settings", () => {
  const registry = settingsRegistry();
  const check = (values: Record<string, unknown>) => {
    const layers: Layer[] = [{ name: "project", path: "/p.yaml", text: "", values }];
    return validateLayers(registry, layers, mergeLayers(layers, registry.appendOnly));
  };

  it("defaults to enabled with two parts", () => {
    expect(moduleValue(executionTreeModule, check({}).value ?? {})).toStrictEqual({
      enabled: true,
      "min-parts": 2,
    });
  });

  it("refuses a threshold below two", () => {
    const problem = check({ execution: { tree: { "min-parts": 1 } } }).problems[0];
    expect(problem).toMatchObject({ rule: "policy/config-invalid" });
  });

  it("keeps execution.concurrency beside it", () => {
    expect(
      check({ execution: { concurrency: 3, tree: { enabled: false } } }).problems,
    ).toStrictEqual([]);
  });

  it("has no workflow switch", () => {
    const problem = check({ features: { workflow: true } }).problems[0];
    expect(problem).toMatchObject({ rule: "policy/unknown-config-key" });
  });
});

describe("the execute wave of bdk next", () => {
  it("marks two independent parts of a large Change tree", async () => {
    const h = await planned("large");
    const report = await next(h);
    expect(report.artifact?.id).toBe("execute-part:01");
    // The Change is still in its plan stage; the artifact belongs to execute.
    expect(report.stage).toBe("plan");
    expect(report.command).toBe("/bdk:execute");
    expect(report.wave).toStrictEqual([
      { part: "01", started: false, tickets: [], mode: "tree" },
      { part: "02", started: false, tickets: [], mode: "tree" },
    ]);
  });

  it("keeps a small Change flat", async () => {
    const h = await planned("small");
    expect((await next(h)).wave?.map((item) => item.mode)).toStrictEqual(["flat", "flat"]);
  });

  it("keeps a tiny Change flat", async () => {
    const h = await planned("tiny");
    expect((await next(h)).wave?.map((item) => item.mode)).toStrictEqual(["flat", "flat"]);
  });

  it("runs flat when the tree is disabled", async () => {
    const h = await planned("large");
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "execution:\n  tree:\n    enabled: false\n");
    expect((await next(h)).wave?.map((item) => item.mode)).toStrictEqual(["flat", "flat"]);
  });

  it("needs min-parts parts not started", async () => {
    const h = await planned("large");
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "execution:\n  tree:\n    min-parts: 3\n");
    expect((await next(h)).wave?.map((item) => item.mode)).toStrictEqual(["flat", "flat"]);
  });

  it("keeps a running lead's part tree and a single part not started flat", async () => {
    const h = await planned("large");
    start(h, "01");
    openTicket(h, "A-1l1l1l1l", "part-lead", "01");
    expect((await next(h)).wave).toStrictEqual([
      { part: "01", started: true, tickets: ["A-1l1l1l1l"], mode: "tree" },
      { part: "02", started: false, tickets: [], mode: "flat" },
    ]);
  });

  it("lists a started flat part with its task tickets", async () => {
    const h = await planned("tiny");
    start(h, "01");
    openTicket(h, "A-2t2t2t2t", "task-redispatch", "01-1");
    expect((await next(h)).wave?.[0]).toStrictEqual({
      part: "01",
      started: true,
      tickets: ["A-2t2t2t2t"],
      mode: "flat",
    });
  });

  it("leaves a dependent part out until its dependency is done", async () => {
    const h = await planned("large", { "02": ["01"] });
    expect((await next(h)).wave).toStrictEqual([
      { part: "01", started: false, tickets: [], mode: "flat" },
    ]);
  });

  it("leaves out a part whose Files: overlap a part listed before it", async () => {
    const shared = (nn: string) =>
      `## ${nn}-1 Edit the client\n\n**Files:**\n\n- \`src/client.ts\`\n- \`src/part-${nn}.ts\`\n\n**Test cases:**\n\n- works\n`;
    const h = await planned("large", {}, true, { "01": shared("01"), "02": shared("02") });
    expect((await next(h)).wave).toStrictEqual([
      { part: "01", started: false, tickets: [], mode: "flat" },
    ]);
    start(h, "01");
    expect((await next(h)).wave?.map((item) => item.part)).toStrictEqual(["01"]);
  });

  it("has no wave while plan-verify is next", async () => {
    const report = await next(await planned("large", {}, false));
    expect(report.artifact?.id).toBe("plan-verify");
    expect(report.wave).toBeUndefined();
  });

  it("names bdk next after part done in the execute-part instruction", async () => {
    const h = await planned("tiny");
    const report = await next(h);
    expect(report.instruction).toContain("`bdk next`");
    expect(report.instruction).toContain("`wave`");
    expect(report.instruction).not.toContain("the result is a ledger entry");
  });
});
