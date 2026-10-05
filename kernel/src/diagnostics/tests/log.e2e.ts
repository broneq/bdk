// `bdk diagnostics log` through the built bundle (`kernel-cli/diagnostics`;
// `kernel-state`, Verbose log): the render of the recorded transcript of
// HOST-FACTS `transcript-layout` with its journal, the header without
// transcripts, input/not-found, and the 20-file cap of the logs directory.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, read, refused, repository } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const SESSION = "00000000-0000-4000-8000-000000000001";

/** A project whose journal points at a copy of the recorded session, or at a missing one. */
function project(copy: boolean): string {
  const home = mkdtempSync(join(tmpdir(), "bdk-transcripts-"));
  if (copy) cpSync(FIXTURE, home, { recursive: true });
  const root = repository({ ".bdk/settings.yaml": "" });
  const lines = [
    {
      v: 1,
      kind: "session",
      at: "2026-10-05T15:04:39.000Z",
      session: SESSION,
      transcript: join(home, `${SESSION}.jsonl`),
      source: "startup",
      bdk: "3.0.0",
      commit: "abc1234",
      host: "2.1.289",
    },
    {
      v: 1,
      kind: "command",
      at: "2026-10-05T15:04:45.200Z",
      command: "change-status",
      args: ["--json"],
      exit: 2,
      rule: "policy/no-active-change",
      ticket: null,
      change: null,
      ms: 41,
    },
    {
      v: 1,
      kind: "command",
      at: "2026-10-05T15:05:08.000Z",
      command: "next",
      args: [],
      exit: 0,
      rule: null,
      ticket: null,
      change: null,
      ms: 30,
    },
  ];
  mkdirSync(join(root, ".bdk/.machine/telemetry"), { recursive: true });
  writeFileSync(
    join(root, ".bdk/.machine/telemetry/journal.jsonl"),
    lines.map((line) => `${JSON.stringify(line)}\n`).join(""),
  );
  return root;
}

describe("bdk diagnostics log", () => {
  it("renders the recorded session: skill, kernel calls, model text, findings, no thinking", () => {
    const root = project(true);
    const result = answered(
      bdk(["diagnostics", "log", "--session", SESSION, "--json"], root),
      "output/diagnostics-log.json",
    );
    expect(result).toMatchObject({ path: `.bdk/.machine/logs/${SESSION}.log`, transcript: "ok" });
    const log = read(root, result.path as string);
    expect(log.split("\n").length - 1).toBe(result.lines);
    expect(log).toContain(`# BDK run log of session ${SESSION}`);
    expect(log).toContain("bdk: 3.0.0 abc1234");
    expect(log).toContain("host: 2.1.289");
    expect(log).toContain("skill bdk-probe:open-stage");
    expect(log).toMatch(/journal:2 change-status --json exit 2 policy\/no-active-change/);
    expect(log).toMatch(/main Bash node \/plugin\/dist\/bdk\.mjs change status --json/);
    expect(log).toMatch(/main result error Exit code 2/);
    expect(log).toContain("OPEN-STAGE-LOADED");
    expect(log).toMatch(/\n15:04:50 {3}a0000000000000001 prompt go\n/);
    expect(log).toMatch(/\n! D1 main main:\d+ {2}Bash command run 2 times/);
    expect(log).not.toContain("redacted");
    expect(log).toContain("# Counts");
    const text = bdk(["diagnostics", "log", "--session", SESSION, "--full"], root);
    expect(text.stdout).toBe(`.bdk/.machine/logs/${SESSION}.log\n`);
  });

  it("writes the journal lines only and says why when the transcripts are gone", () => {
    const root = project(false);
    const result = answered(
      bdk(["diagnostics", "log", "--json"], root),
      "output/diagnostics-log.json",
    );
    expect(result.transcript).toBe("missing");
    const log = read(root, result.path as string);
    expect(log).toContain("transcript: missing (a transcript file is gone; journal lines only)");
    expect(log).toContain("journal:2 change-status --json exit 2 policy/no-active-change");
    expect(log).not.toContain(" Bash ");
  });

  it("refuses a session the journal does not know", () => {
    refused(
      bdk(
        ["diagnostics", "log", "--session", "00000000-0000-0000-0000-000000000000", "--json"],
        project(false),
      ),
      3,
      "input/not-found",
    );
  });

  it("keeps the 20 newest files of the logs directory", () => {
    const root = project(false);
    const logs = join(root, ".bdk/.machine/logs");
    mkdirSync(logs, { recursive: true });
    for (let index = 0; index < 25; index += 1) {
      const path = join(logs, `old-${String(index).padStart(2, "0")}.log`);
      writeFileSync(path, "old\n");
      const time = new Date(Date.UTC(2026, 0, 1, 0, index));
      utimesSync(path, time, time);
    }
    answered(bdk(["diagnostics", "log", "--json"], root), "output/diagnostics-log.json");
    const left = readdirSync(logs).sort();
    expect(left).toHaveLength(20);
    expect(left).toContain(`${SESSION}.log`);
    expect(left).not.toContain("old-05.log");
    expect(left).toContain("old-06.log");
  });
});
