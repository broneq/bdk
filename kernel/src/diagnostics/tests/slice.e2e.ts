// `bdk diagnostics slice` through the built bundle (`kernel-cli/diagnostics`):
// a journal cite resolved through its transcript use, an agent cite, a ledger
// id of the session's Change, the 100-event limit, the 200-line cap, and
// input/not-found for a cite past the journal or an agent with no transcript.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { started } from "../../attempt/tests/e2e-support.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const SESSION = "00000000-0000-4000-8000-000000000001";
const JOURNAL = ".bdk/.machine/telemetry/journal.jsonl";

/** A started Change whose journal starts the recorded session; returns the root and the main transcript. */
function project(): { readonly root: string; readonly main: string } {
  const home = mkdtempSync(join(tmpdir(), "bdk-transcripts-"));
  cpSync(FIXTURE, home, { recursive: true });
  const main = join(home, `${SESSION}.jsonl`);
  const { root } = started();
  const lines = [
    {
      v: 1,
      kind: "session",
      at: "2026-10-05T15:04:39.000Z",
      session: SESSION,
      transcript: main,
      source: "startup",
      bdk: "3.0.0",
      commit: null,
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
  ];
  writeFileSync(join(root, JOURNAL), lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
  return { root, main };
}

function slice(root: string, ...args: string[]) {
  return bdk(["diagnostics", "slice", ...args, "--session", SESSION, "--json"], root);
}

describe("bdk diagnostics slice", () => {
  it("centres a journal cite on its matching tool use", () => {
    const { root } = project();
    const result = answered(
      slice(root, "journal:2", "--before", "1", "--after", "1"),
      "output/diagnostics-slice.json",
    );
    expect(result).toMatchObject({ agent: "main", at: "2026-10-05T15:04:44.953Z", omitted: 0 });
    const events = result.events as string[];
    expect(
      events.some((line) =>
        line.includes("main Bash node /plugin/dist/bdk.mjs change status --json"),
      ),
    ).toBe(true);
    expect(events.some((line) => line.includes("main result error Exit code 2"))).toBe(true);
    expect(events.join("\n")).not.toContain("redacted");
  });

  it("reads an agent cite in that agent's transcript", () => {
    const { root } = project();
    const result = answered(
      slice(root, "a0000000000000001:11", "--before", "0", "--after", "1"),
      "output/diagnostics-slice.json",
    );
    expect(result).toMatchObject({ agent: "a0000000000000001", at: "2026-10-05T15:04:52.295Z" });
    expect((result.events as string[])[0]).toBe(
      "15:04:52 a0000000000000001 Bash echo probe-worker",
    );
  });

  it("resolves a ledger id of the session's Change to its time on the main thread", () => {
    const { root } = project();
    const entry = answered(
      bdk(["log", "add", "observation", "slow parser", "--ref", "01-1", "--json"], root),
      "output/log-add.json",
    );
    const result = answered(
      slice(root, (entry.entry as { id: string }).id, "--before", "2", "--after", "0"),
      "output/diagnostics-slice.json",
    );
    expect(result.agent).toBe("main");
    expect((result.events as string[]).length).toBeGreaterThan(0);
  });

  it("refuses more than 100 events and caps the output at 200 lines", () => {
    const { root, main } = project();
    const bounded = refused(
      slice(root, "main:40", "--before", "51", "--after", "50"),
      3,
      "input/invalid-argument",
    );
    expect(bounded.why).toContain("100");
    refused(slice(root, "main:40", "--before", "x"), 3, "input/invalid-argument");
    // The model's text prints whole, so one long reply pushes the excerpt past 200 lines.
    const long = Array.from({ length: 300 }, (_, index) => `row ${String(index)}`).join("\n");
    const step = '"text":"Step 2 - running echo probe-repeat."';
    expect(readFileSync(main, "utf8")).toContain(step);
    writeFileSync(main, readFileSync(main, "utf8").replace(step, `"text":${JSON.stringify(long)}`));
    const result = answered(
      slice(root, "main:40", "--before", "50", "--after", "50"),
      "output/diagnostics-slice.json",
    );
    expect((result.events as string[]).length).toBe(200);
    expect(result.omitted).toBeGreaterThan(0);
  });

  it("refuses a cite past the journal and an agent with no transcript", () => {
    const { root } = project();
    expect(refused(slice(root, "journal:999"), 3, "input/not-found").why).toContain("journal:999");
    expect(refused(slice(root, "a00000000000000ff:3"), 3, "input/not-found").why).toContain(
      "a00000000000000ff",
    );
  });
});
