import { describe, expect, it } from "vitest";

import { costOf, projection } from "./cost.ts";

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

  it("refuses a result without any cost, so a run is never counted as free", () => {
    expect(() => costOf({ response: {} })).toThrow(/no cost/);
  });
});
