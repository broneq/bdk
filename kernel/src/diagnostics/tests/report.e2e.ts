// `bdk diagnostics report` through the built bundle (`kernel-cli/diagnostics`):
// a seeded run journal for the counts, --stage, the session choice and
// input/not-found, and a journal pointing at the recorded transcript of
// HOST-FACTS `transcript-layout` for attribution, tokens, cost and D1.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused, repository } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const FIXTURE_SESSION = "00000000-0000-4000-8000-000000000001";
const S = "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11";
const OTHER = "7e2a0000-0000-4000-8000-000000000002";

type Fields = Readonly<Record<string, unknown>>;

function sessionLine(at: string, session: string, transcript: string | null = null): Fields {
  return {
    v: 1,
    kind: "session",
    at,
    session,
    transcript,
    source: "startup",
    bdk: "3.0.0",
    commit: null,
    host: "2.1.289",
  };
}

function commandLine(
  at: string,
  command: string,
  args: string[],
  rule: string | null = null,
): Fields {
  return {
    v: 1,
    kind: "command",
    at,
    command,
    args,
    exit: rule === null ? 0 : rule.startsWith("input/") ? 3 : 2,
    rule,
    ticket: null,
    change: null,
    ms: 40,
  };
}

/** A project whose journal holds `lines`. */
function project(lines: readonly Fields[]): string {
  const root = repository({ ".bdk/settings.yaml": "" });
  mkdirSync(join(root, ".bdk/.machine/telemetry"), { recursive: true });
  writeFileSync(
    join(root, ".bdk/.machine/telemetry/journal.jsonl"),
    lines.map((line) => `${JSON.stringify(line)}\n`).join(""),
  );
  return root;
}

const at = (second: number) => new Date(Date.UTC(2026, 9, 5, 14, 0, second)).toISOString();

describe("bdk diagnostics report", () => {
  it("counts the refusals of a seeded journal and cites a D3 finding", () => {
    const root = project([
      sessionLine(at(0), S),
      ...[1, 2, 3].map((s) =>
        commandLine(at(s), "evidence-record", [String(s)], "policy/missing-evidence"),
      ),
      ...[4, 5].map((s) => commandLine(at(s), "log-add", [String(s)], "input/invalid-envelope")),
    ]);
    const report = answered(
      bdk(["diagnostics", "report", "--session", S, "--json"], root),
      "output/diagnostics-report.json",
    );
    expect(report).toMatchObject({
      session: S,
      transcript: "unavailable",
      truncated: false,
      refusals: {
        total: 5,
        byRule: { "policy/missing-evidence": 3, "input/invalid-envelope": 2 },
        byRole: { unknown: 5 },
      },
      cost: null,
    });
    expect(report.findings).toStrictEqual([
      expect.objectContaining({
        detector: "D3",
        cite: "journal:4",
        summary: "policy/missing-evidence refused 3 times",
      }),
    ]);
    const text = bdk(["diagnostics", "report", "--session", S], root);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain(
      "refusals 5  policy/missing-evidence 3  input/invalid-envelope 2",
    );
    expect(text.stdout).toContain("! D3 ");
  });

  it("narrows --stage to the stage skill's lines", () => {
    const root = project([
      sessionLine(at(0), S),
      commandLine(at(1), "ctx-skill", ["plan"]),
      commandLine(at(2), "next", [], "policy/gate-not-ready"),
      commandLine(at(3), "ctx-skill", ["execute"]),
      commandLine(at(4), "evidence-record", [], "policy/missing-evidence"),
      commandLine(at(5), "ctx-skill", ["verify-plan"]),
    ]);
    const report = answered(
      bdk(["diagnostics", "report", "--stage", "execute", "--json"], root),
      "output/diagnostics-report.json",
    );
    expect(report).toMatchObject({
      stage: "execute",
      from: at(3),
      to: at(4),
      refusals: { total: 1 },
    });
    const missing = refused(
      bdk(["diagnostics", "report", "--stage", "close", "--json"], root),
      3,
      "input/not-found",
    );
    expect(missing.instead).toStrictEqual([`bdk diagnostics report --session ${S}`]);
  });

  it("reads the latest session without --session and the named one with it", () => {
    const root = project([
      sessionLine(at(0), S),
      commandLine(at(1), "next", [], "policy/gate-not-ready"),
      sessionLine(at(2), OTHER),
      commandLine(at(3), "next", [], "policy/no-active-change"),
    ]);
    const latest = answered(
      bdk(["diagnostics", "report", "--json"], root),
      "output/diagnostics-report.json",
    );
    expect(latest).toMatchObject({
      session: OTHER,
      refusals: { byRule: { "policy/no-active-change": 1 } },
    });
    const named = answered(
      bdk(["diagnostics", "report", "--session", S, "--json"], root),
      "output/diagnostics-report.json",
    );
    expect(named).toMatchObject({
      session: S,
      refusals: { byRule: { "policy/gate-not-ready": 1 } },
    });
  });

  it("refuses an unknown session and an empty journal with input/not-found", () => {
    const root = project([sessionLine(at(0), S)]);
    const unknown = "00000000-0000-0000-0000-000000000000";
    const refusal = refused(
      bdk(["diagnostics", "report", "--session", unknown, "--json"], root),
      3,
      "input/not-found",
    );
    expect(refusal.why).toContain(unknown);
    expect(refusal.instead).toStrictEqual(["bdk diagnostics report"]);
    refused(bdk(["diagnostics", "report", "--json"], repository()), 3, "input/not-found");
  });

  it("reads the recorded transcript: attribution, tokens, cost and a repeated Bash command", () => {
    const home = mkdtempSync(join(tmpdir(), "bdk-transcripts-"));
    cpSync(FIXTURE, home, { recursive: true });
    const main = join(home, `${FIXTURE_SESSION}.jsonl`);
    const root = project([
      sessionLine("2026-10-05T15:04:39.000Z", FIXTURE_SESSION, main),
      {
        ...commandLine(
          "2026-10-05T15:04:45.200Z",
          "change-status",
          ["--json"],
          "policy/no-active-change",
        ),
      },
      commandLine("2026-10-05T15:05:08.000Z", "next", []),
    ]);
    const report = answered(
      bdk(["diagnostics", "report", "--session", FIXTURE_SESSION, "--json"], root),
      "output/diagnostics-report.json",
    );
    const state = readFileSync(main, "utf8")
      .split("\n")
      .filter((line) => line.includes('"type":"cost-state"'))
      .map((line) => JSON.parse(line) as { totalCostUSD: number })[0];
    expect(report).toMatchObject({
      transcript: "ok",
      unknownLines: 0,
      refusals: { total: 1, byRole: { main: 1 } },
      cost: { totalUSD: state?.totalCostUSD },
      tokensUnknownAgents: 0,
    });
    const agents = report.agents as { agent: string; tokens: Record<string, unknown> | null }[];
    expect(Object.keys(agents[0]?.tokens ?? {})).toStrictEqual(["claude-haiku-4-5-20251001"]);
    const findings = report.findings as { detector: string; agent: string; summary: string }[];
    expect(findings).toContainEqual(
      expect.objectContaining({
        detector: "D1",
        agent: "main",
        summary: expect.stringContaining("echo probe-repeat") as string,
      }),
    );
  });
});
