import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  journalFacts,
  reportAgents,
  roundPackages,
  roundReports,
  splitFrontmatter,
} from "./facts.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("splitFrontmatter", () => {
  it("parses the frontmatter and keeps the body", () => {
    expect(splitFrontmatter("---\nrole: judge\ngroup: judge\n---\nBody\n")).toStrictEqual({
      data: { role: "judge", group: "judge" },
      body: "Body\n",
    });
    expect(splitFrontmatter("No frontmatter\n")).toStrictEqual({
      data: {},
      body: "No frontmatter\n",
    });
  });
});

describe("journalFacts", () => {
  it("collects guard denials and the last stop of each agent, skipping broken lines", () => {
    const journal = [
      JSON.stringify({ kind: "guard", agent: "a1", rule: "guard/reader-write", at: "T0" }),
      "not json",
      JSON.stringify({ kind: "agent-stop", agent: "a1", at: "T1" }),
      JSON.stringify({ kind: "command", rule: "policy/x", at: "T2" }),
      JSON.stringify({ kind: "agent-stop", agent: "a1", at: "T3" }),
    ].join("\n");
    const { guards, stops } = journalFacts(journal);
    expect(guards).toStrictEqual([{ agent: "a1", rule: "guard/reader-write" }]);
    expect(stops).toStrictEqual(new Map([["a1", "T3"]]));
  });
});

describe("reportAgents", () => {
  it("sums every token count of an agent and joins its stop time", () => {
    const report = {
      agents: [
        {
          agent: "a1",
          type: "bdk:judge",
          role: "judge",
          wallMs: 4_000,
          tokens: { sonnet: { input: 10, output: 5, cacheRead: 100 } },
        },
        { agent: "a2", type: "bdk:reader", role: null, wallMs: null, tokens: null },
      ],
    };
    expect(reportAgents(report, new Map([["a1", "T9"]]))).toStrictEqual([
      { agent: "a1", role: "judge", wallMs: 4_000, tokens: 115, stoppedAt: "T9" },
      { agent: "a2", role: null, wallMs: null, tokens: null },
    ]);
    expect(reportAgents(undefined, new Map())).toStrictEqual([]);
  });
});

describe("roundPackages and roundReports", () => {
  it("read the grouped packages and reports of a Change directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-review-round-"));
    dirs.push(dir);
    mkdirSync(join(dir, "dispatch"));
    mkdirSync(join(dir, "reports"));
    writeFileSync(
      join(dir, "dispatch", "c-judge-A-1-judge.md"),
      "---\nrole: judge\ngroup: judge\nentries: [L-a, L-b]\n---\nPackage\n",
    );
    writeFileSync(
      join(dir, "dispatch", "c-reviewer-A-1-p01.md"),
      "---\nrole: reviewer\ngroup: p01\nfiles: [src/a.ts]\n---\nPackage\n",
    );
    writeFileSync(
      join(dir, "dispatch", "01-1-implementer-A-0.md"),
      "---\nrole: implementer\n---\n",
    );
    writeFileSync(
      join(dir, "reports", "c-reviewer-A-1-p01.md"),
      "---\nrole: reviewer\ngroup: p01\n---\nReviewed.\n",
    );
    expect(roundPackages(dir)).toStrictEqual([
      { role: "judge", group: "judge", files: [], entries: ["L-a", "L-b"] },
      { role: "reviewer", group: "p01", files: ["src/a.ts"], entries: [] },
    ]);
    expect(roundReports(dir)).toStrictEqual([
      { role: "reviewer", group: "p01", body: "Reviewed.\n" },
    ]);
  });
});
