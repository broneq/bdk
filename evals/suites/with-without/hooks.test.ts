import { describe, expect, it } from "vitest";

import { measure } from "./hooks.ts";

describe("measure", () => {
  it("records the assertions, turns and wall time", () => {
    expect(
      measure({
        gradingResult: { pass: false, score: 0.5 },
        response: { metadata: { numTurns: 4, durationMs: 12_500 } },
      }).metrics,
    ).toEqual({ assert_pass: 0, assert_score: 0.5, turns: 4, wall_s: 12.5 });
  });

  it("marks the assertion metrics as not applying when the task has none", () => {
    expect(measure({ gradingResult: null, response: {} }).metrics).toEqual({
      assert_pass: null,
      assert_score: null,
      turns: null,
      wall_s: null,
    });
  });
});
