import { describe, expect, it } from "vitest";

import { roundMetrics, verdictLines } from "./round.ts";
import type { RoundFacts } from "./round.ts";
import type { ReviewEntry } from "./metrics.ts";

const SEAMS = "Reviewed.\n\n## Seams\n\n- src/api/http.ts: parseApiProblem result\n";
const INTEGRATION = "Traced.\n\n## Intent\n\n| a | b |\n\n## Areas\n\n- auth: x\n";
const JUDGE =
  "Judged.\n\n## Verdicts\n\n- L-a: should-fix: the null body reaches parse\n- L-b: not-a-problem: a guard upstream\n";

function facts(fields: Partial<RoundFacts> = {}): RoundFacts {
  return {
    agents: [
      { agent: "a1", role: "reviewer", wallMs: 60_000, tokens: 1_000, stoppedAt: "T1" },
      {
        agent: "a2",
        role: "integration-reviewer",
        wallMs: 120_000,
        tokens: 5_000,
        stoppedAt: "T3",
      },
      { agent: "a3", role: "runner", wallMs: 300_000, tokens: 2_000, stoppedAt: "T5" },
      { agent: "a4", role: "judge", wallMs: 90_000, tokens: 3_000, stoppedAt: "T4" },
    ],
    guards: [
      { agent: "a1", rule: "guard/reader-write" },
      { agent: "a3", rule: "guard/reader-write" },
      { agent: "a4", rule: "guard/judge-scope" },
    ],
    packages: [
      { role: "reviewer", group: "p01", files: ["src/api/http.ts"], entries: [] },
      { role: "reviewer", group: "p02", files: ["src/ui/a.ts", "snap/a.png"], entries: [] },
      { role: "runner", group: "gate", files: [], entries: [] },
      { role: "judge", group: "judge", files: [], entries: ["L-a", "L-b", "L-c"] },
    ],
    reports: [
      { role: "reviewer", group: "p01", body: SEAMS },
      { role: "reviewer", group: "p02", body: "Reviewed, no seams.\n" },
      { role: "integration-reviewer", group: "integration", body: INTEGRATION },
      { role: "judge", group: "judge", body: JUDGE },
    ],
    binary: ["snap/a.png"],
    ...fields,
  };
}

const ENTRIES: ReviewEntry[] = [
  {
    id: "L-a",
    type: "finding",
    summary: "",
    refs: [],
    level: "should-fix",
    body: "Problem: x\n\nFailure scenario: y\n",
  },
  {
    id: "L-b",
    type: "finding",
    summary: "",
    refs: [],
    level: "nice-to-have",
    body: "Problem: x\n",
  },
  { id: "L-c", type: "observation", summary: "", refs: [], body: "Note.\n" },
];

describe("verdictLines", () => {
  it("reads the id and the level of each line of the Verdicts section", () => {
    expect(verdictLines(JUDGE)).toStrictEqual(
      new Map([
        ["L-a", "should-fix"],
        ["L-b", "not-a-problem"],
      ]),
    );
    expect(verdictLines("No section.\n")).toStrictEqual(new Map());
  });
});

describe("roundMetrics", () => {
  it("measures the round's agents, denials, reports and verdicts", () => {
    expect(roundMetrics(facts(), ENTRIES)).toStrictEqual({
      integration_wall_s: 120,
      integration_tokens: 5_000,
      judge_wall_s: 90,
      judge_tokens: 3_000,
      judge_before_gate: 1,
      binary_groups: 1,
      reader_write_denials: 1,
      judge_scope_denials: 1,
      reports_without_seams: 1,
      intent_before_areas: 1,
      findings_without_failure_scenario: 1,
      // L-a holds the level its line names; L-b does not; L-c has no line.
      verdict_coverage: 1 / 3,
    });
  });

  it("leaves out the judge's metrics on a round without a judge", () => {
    const metrics = roundMetrics(
      facts({
        agents: [{ agent: "a2", role: "integration-reviewer", wallMs: 1_000, tokens: null }],
        packages: [],
        reports: [
          { role: "integration-reviewer", group: "integration", body: "## Areas\n\n## Intent\n" },
        ],
        guards: [],
      }),
      [],
    );
    expect(metrics).toStrictEqual({
      integration_wall_s: 1,
      binary_groups: 0,
      reader_write_denials: 0,
      judge_scope_denials: 0,
      reports_without_seams: 0,
      intent_before_areas: 0,
      findings_without_failure_scenario: 0,
    });
  });
});
