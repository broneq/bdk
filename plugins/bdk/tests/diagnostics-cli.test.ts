import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { build } from "../build.ts";
import { reportResult } from "../src/diagnostics/schema/report.ts";

// Acceptance of #322 against the built CLI run through `bin/bdk` (spec `bdk-cli/diagnostics`) on
// the recorded `/bdk:debug` run of the diagnose-run eval fixture (evals/fixtures/diagnose-run/).

const PLUGIN = join(import.meta.dirname, "..");
const FIXTURE = join(PLUGIN, "evals", "fixtures", "diagnose-run");
const SESSION = "6628cb23-c027-4406-b77a-5a6ff8d1b58b";
const REVIEW_LEAD = "a4aa7d0eb43a6a939";
const JUDGE = "a8825458cd75f6395";

let root: string;
let bdk: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "bdk-diagnostics-"));
  for (const dir of [".claude-plugin", "bin"]) {
    cpSync(join(PLUGIN, dir), join(root, "plugin", dir), { recursive: true });
  }
  cpSync(join(FIXTURE, "runs"), join(root, "project", ".bdk", "runs"), { recursive: true });
  await build({ outfile: join(root, "plugin", "dist", "bdk.mjs") });
  bdk = join(root, "plugin", "bin", "bdk");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function report(transcripts: string) {
  const { status, stdout, stderr } = spawnSync(
    bdk,
    ["diagnostics", "report", "fix-total-crash", "--transcripts", transcripts, "--json"],
    { cwd: join(root, "project"), encoding: "utf8" },
  );
  expect(stderr).toBe("");
  expect(status).toBe(0);
  const result = reportResult.parse(JSON.parse(stdout));
  expect(result.sessions).toHaveLength(1);
  const [session] = result.sessions;
  if (session === undefined) throw new Error("no session in the report");
  return { transcripts: result.transcripts, session };
}

/** The transcript line a `<file>:<line>` citation names, parsed. */
function cited(transcripts: string, cite: string): Record<string, unknown> {
  const at = cite.lastIndexOf(":");
  const lines = readFileSync(join(transcripts, cite.slice(0, at)), "utf8").split("\n");
  return JSON.parse(lines[Number(cite.slice(at + 1)) - 1] ?? "") as Record<string, unknown>;
}

describe("bdk diagnostics report, built", () => {
  it("counts the recorded run: stages, agents, host cost and the review lead's slow wait", () => {
    const dir = join(root, "full");
    cpSync(join(FIXTURE, "transcripts"), dir, { recursive: true });
    const { transcripts, session } = report(dir);

    expect(session.id).toBe(SESSION);
    expect(session.cost?.totalUSD).toBeCloseTo(1.7767, 4);
    expect(session.stages.map((stage) => stage.skill)).toEqual([
      "bdk:diagnose-bug",
      "bdk:commit",
      "bdk:execute",
      "bdk:auto-review",
      "bdk:triage",
    ]);
    expect(session.agents).toHaveLength(10);
    expect(session.agents.every((agent) => agent.state === "ok" && agent.costUSD !== null)).toBe(
      true,
    );
    const costs = session.agents.reduce((sum, agent) => sum + (agent.costUSD ?? 0), 0);
    expect(costs).toBeCloseTo(session.cost?.totalUSD ?? 0, 6);

    const slow = session.findings.find((finding) => finding.detector === "slow-call");
    expect(slow).toMatchObject({ agent: REVIEW_LEAD, agentType: "bdk:lead" });
    const call = cited(transcripts, slow?.cites[0] ?? "");
    expect(JSON.stringify(call)).toContain('"type":"tool_use"');
  });

  it("names the agent whose transcript is missing and still counts the others", () => {
    const dir = join(root, "partial");
    cpSync(join(FIXTURE, "transcripts"), dir, { recursive: true });
    rmSync(join(dir, SESSION, "subagents", `agent-${JUDGE}.jsonl`));
    const { session } = report(dir);

    expect(session.agents).toHaveLength(10);
    expect(session.agents.find((agent) => agent.id === JUDGE)).toMatchObject({
      type: "bdk:judge",
      state: "missing",
      costUSD: null,
    });
    const others = session.agents.filter((agent) => agent.id !== JUDGE);
    expect(others.every((agent) => agent.state === "ok" && agent.costUSD !== null)).toBe(true);
    expect(session.findings).toContainEqual(
      expect.objectContaining({ detector: "missing-transcript", agent: JUDGE }),
    );
  });
});
