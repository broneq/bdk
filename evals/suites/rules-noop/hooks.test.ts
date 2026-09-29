import { describe, expect, it } from "vitest";

import type { EvalResult, RunContext } from "../../harness/hook.ts";
import type { JudgeRequest, Judgement } from "../../harness/judge.ts";
import type { Bullet } from "./bullets.ts";
import { createHooks, replyText } from "./hooks.ts";
import type { MeasurementKind } from "./hooks.ts";
import type { Violations } from "./patches.ts";

const bullets: Bullet[] = [
  { id: "security.02.bbbbbbbb", file: "rules/security.md", ordinal: 2, text: "**Inject.** No." },
  { id: "security.03.cccccccc", file: "rules/security.md", ordinal: 3, text: "**Encode.** Yes." },
];

const violations: Violations = {
  patches: [
    {
      patch: "01-a",
      violations: [
        { bullet: "security.02.bbbbbbbb", file: "a.ts", line: 3, what: "exec with input" },
        { bullet: "security.03.cccccccc", file: "a.ts", line: 9, what: "raw HTML" },
      ],
    },
    { patch: "02-clean", violations: [] },
  ],
  notSeedable: [],
};

function context(
  kind: MeasurementKind,
  item: string,
  vars: Record<string, string> = {},
): RunContext {
  const cell = {
    debugFile: "",
    expectedPlugins: 0,
    workDir: null,
    fixtureBase: null,
    provenance: { fixtureCommit: null, bdkCommit: "b".repeat(40), variantHash: null },
    settings: { measurement: kind },
  };
  return {
    plan: {
      suite: "rules-noop",
      series: "s",
      ledgerFile: "",
      budgetUsd: 1,
      runCapUsd: 1,
      resultsFile: "",
      rawDir: "",
      cells: { c: cell },
    },
    cellName: "c",
    cell,
    item,
    run: 1,
    vars,
  };
}

function reply(output: unknown): EvalResult {
  return { response: { output } };
}

function hooksAnswering(output: unknown): {
  requests: JudgeRequest[];
  measure: ReturnType<typeof createHooks>["measure"];
} {
  const requests: JudgeRequest[] = [];
  recorded.length = 0;
  const hooks = createHooks({
    judge: (request): Promise<Judgement> => {
      requests.push(request);
      return Promise.resolve({ output, cost: 0.02, models: ["claude-sonnet-5"] });
    },
    bullets: () => bullets,
    violations: () => violations,
    record: (_context, request, judgement) => {
      recorded.push({ prompt: request.prompt, answer: judgement.output });
    },
  });
  return { requests, measure: hooks.measure };
}

const recorded: { prompt: string; answer: unknown }[] = [];

describe("replyText", () => {
  it("reads a string or the text of content blocks", () => {
    expect(replyText("a")).toBe("a");
    expect(replyText([{ type: "text", text: "a" }, { type: "tool_use" }, "b"])).toBe("a\nb");
    expect(replyText(undefined)).toBe("");
  });
});

describe("M1 measure", () => {
  it("judges the answer against its bullet and records the outcome value", async () => {
    const { requests, measure } = hooksAnswering({
      outcome: "WRONG",
      reason: "r",
      uncertain: true,
    });
    const measured = await measure(
      context("m1", "security.02.bbbbbbbb", { question: "Why?" }),
      reply("Concatenate."),
    );
    expect(measured).toEqual({
      metrics: { knowledge: -1, uncertain: 1 },
      extraCost: 0.02,
      templateHashes: [],
      models: ["claude-sonnet-5"],
    });
    expect(requests[0]?.prompt).toContain("**Inject.** No.");
    expect(requests[0]?.prompt).toContain("Why?");
    expect(requests[0]?.prompt).toContain("Concatenate.");
    expect(recorded).toEqual([
      { prompt: requests[0]?.prompt, answer: { outcome: "WRONG", reason: "r", uncertain: true } },
    ]);
  });

  it("refuses an unknown bullet and a judge answer without an outcome", async () => {
    await expect(
      hooksAnswering({ outcome: "COVERED" }).measure(context("m1", "nosuch"), reply("x")),
    ).rejects.toThrow(/no rule bullet nosuch/);
    await expect(
      hooksAnswering({ reason: "r" }).measure(context("m1", "security.02.bbbbbbbb"), reply("x")),
    ).rejects.toThrow(/no outcome/);
  });
});

describe("M2 measure", () => {
  it("records each seeded violation as found or not, and the claimed count", async () => {
    const { requests, measure } = hooksAnswering({
      problems: [
        { id: "P1", found: true },
        { id: "P2", found: false },
      ],
      claimed: 4,
      uncertain: false,
    });
    const measured = await measure(context("m2", "01-a"), reply("- a.ts:3 [high] exec"));
    expect(measured.metrics).toEqual({
      claimed: 4,
      uncertain: 0,
      "security.02.bbbbbbbb@a.ts:3": 1,
      "security.03.cccccccc@a.ts:9": 0,
    });
    expect(requests[0]?.prompt).toContain("P2: a.ts:9: raw HTML (rule: **Encode.** Yes.)");
  });

  it("judges only the claimed count on a clean control", async () => {
    const measured = await hooksAnswering({ problems: [], claimed: 1 }).measure(
      context("m2", "02-clean"),
      reply("- b.ts:1 [low] naming"),
    );
    expect(measured.metrics).toEqual({ claimed: 1, uncertain: 0 });
  });

  it("refuses a judge answer that skips a seeded violation", async () => {
    await expect(
      hooksAnswering({ problems: [{ id: "P1", found: true }], claimed: 1 }).measure(
        context("m2", "01-a"),
        reply("x"),
      ),
    ).rejects.toThrow(/judge skipped P2/);
  });

  it("discards an empty reply before any judge call", async () => {
    const { requests, measure } = hooksAnswering({ problems: [], claimed: 0 });
    await expect(measure(context("m2", "02-clean"), reply(" "))).rejects.toThrow(/empty reply/);
    expect(requests).toEqual([]);
  });
});
