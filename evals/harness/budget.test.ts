import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  BudgetReached,
  assertCanStart,
  costOf,
  projection,
  readLedger,
  record,
  runCap,
  spent,
} from "./budget.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function ledgerPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-budget-"));
  dirs.push(dir);
  return join(dir, "budget.json");
}

describe("ledger", () => {
  it("starts empty and sums every run of every suite", () => {
    const path = ledgerPath();
    expect(spent(readLedger(path))).toBe(0);
    record(path, { suite: "execute-ab", cell: "v3-thin", run: 1, cost: 2.5 });
    record(path, { suite: "rules-noop", cell: "m1-haiku", run: 1, cost: 0.25 });
    const ledger = readLedger(path);
    expect(ledger.entries).toHaveLength(2);
    expect(spent(ledger)).toBeCloseTo(2.75);
    expect(ledger.entries[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuses to start a run once the spent cost reaches the budget, naming it", () => {
    const path = ledgerPath();
    record(path, { suite: "execute-ab", cell: "v2", run: 1, cost: 60 });
    expect(() => {
      assertCanStart(readLedger(path), 100);
    }).not.toThrow();
    record(path, { suite: "execute-ab", cell: "v2", run: 2, cost: 40 });
    expect(() => {
      assertCanStart(readLedger(path), 100);
    }).toThrow(BudgetReached);
    expect(() => {
      assertCanStart(readLedger(path), 100);
    }).toThrow(/100 USD/);
    expect(() => {
      assertCanStart(readLedger(path), 150);
    }).not.toThrow();
  });
});

describe("per-run cap", () => {
  it("is the smaller of the remaining budget and the per-run cap", () => {
    const path = ledgerPath();
    record(path, { suite: "execute-ab", cell: "v2", run: 1, cost: 95 });
    expect(runCap(readLedger(path), 100, 10)).toBeCloseTo(5);
    expect(runCap(readLedger(ledgerPath()), 100, 10)).toBe(10);
  });
});

describe("projection", () => {
  it("multiplies each cell's probe cost by the runs per cell", () => {
    expect(projection({ v2: 3, "v3-thin": 2 }, 5)).toEqual({
      perCell: { v2: 15, "v3-thin": 10 },
      total: 25,
    });
  });
});

describe("costOf", () => {
  it("reads the provider's reported cost", () => {
    expect(costOf({ response: { cost: 0.03 } })).toBe(0.03);
  });

  it("falls back to the sum of the per-model costs", () => {
    const result = {
      response: {
        metadata: {
          modelUsage: { "claude-opus-5-5": { costUSD: 1.5 }, "claude-haiku-4-5": { costUSD: 0.5 } },
        },
      },
    };
    expect(costOf(result)).toBe(2);
  });

  it("refuses a result without any cost, so the ledger never undercounts silently", () => {
    expect(() => costOf({ response: {} })).toThrow(/no cost/);
  });
});
