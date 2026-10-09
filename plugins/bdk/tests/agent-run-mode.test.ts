import { describe, expect, it } from "vitest";

import { skillAgentCalls } from "./skill-agent-calls.ts";

// Spec `bdk-plugin`, "Every Agent call names its run mode": a host that gets no
// `run_in_background` value may start the agent in the background, and a lead that waits for a
// background worker polls for minutes (#326). Every Agent call a skill writes names the value.

const RUN_MODE = /run_in_background: (?:false|true)/;
const calls = skillAgentCalls();

describe("Agent call run mode", () => {
  it("names run_in_background on every Agent call of a skill", () => {
    const withoutMode = calls
      .filter(({ paragraph }) => !RUN_MODE.test(paragraph))
      .map(({ skill, agent }) => `${skill}: ${agent}`);
    expect([...new Set(withoutMode)]).toEqual([]);
  });

  it("reads the worker calls of every lead skill", () => {
    const leadCalls = (skill: string) =>
      [...new Set(calls.filter((call) => call.skill === skill).map((call) => call.agent))].sort();
    expect(leadCalls("execute-waves")).toEqual(["conformer", "implementer"]);
    expect(leadCalls("review-round")).toEqual([
      "e2e-tester",
      "integration-reviewer",
      "judge",
      "reviewer",
      "verifier",
    ]);
    expect(leadCalls("pr-review-round")).toEqual(["integration-reviewer", "judge", "reviewer"]);
  });
});
