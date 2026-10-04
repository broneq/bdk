// `bdk change close` through the real registry on an in-memory repository
// (`kernel-cli/change`; T30-D11, D12). A trimmed pipeline (intent,
// gate:review, close) puts the Change one user transition from its close;
// the rebase and hook refusals need a real repository (`change.e2e.ts`).
import { describe, expect, it } from "vitest";

import { harness, passGate, PLUGIN, writeEntry } from "../../graph/tests/support.ts";
import type { Harness } from "../../graph/tests/support.ts";
import { AUTHOR, BRANCH, CHANGE, DIR, ROOT, writePackage } from "../../log/tests/support.ts";
import type { GitResult } from "../../shared/git/index.ts";
import { readMarker, writeDocument } from "../../shared/store/index.ts";
import { changeCloseOutput } from "../schema/outputs.ts";

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T11:00:00.000Z";
const ARCHIVE = `${ROOT}/.bdk/changes/archive/${CHANGE}`;
const SPEC = `${ROOT}/.bdk/specs/auth/login/spec.md`;
const PURPOSE = "Signing in without a password, through a link sent by e-mail.";
const DELTA = `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n### Requirement: Magic link sent\n\nThe system SHALL send a link.\n\n#### Scenario: sent\n\n- **WHEN** asked\n- **THEN** a link is sent\n`;

const PIPELINE = `schema: 1
stages:
  - { id: intent, command: /bdk:change }
  - { id: review, command: /bdk:cr }
  - { id: close, command: /bdk:close }
nodes:
  - { id: intent, kind: intent, stage: intent }
  - { id: gate:review, kind: gate, stage: review, requires: [intent], policy: review, opens: close }
  - { id: close, kind: close, stage: close, requires: [gate:review] }
`;

interface Closing extends Harness {
  /** Every git call, for the commit assertions. */
  readonly calls: string[][];
  /** Lines `git log` answers for the trailer commits. */
  log: string;
}

function closing(options: { gate?: "user" | "policy" | "none" } = {}): Closing {
  const h = harness();
  h.store.write(`${PLUGIN}/pipeline/pipeline.yaml`, PIPELINE);
  if (options.gate !== "none") passGate(h.store, "gate:review", "close", T0, options.gate);
  const calls: string[][] = [];
  const state: Closing = { ...h, calls, log: "" };
  const base = h.git.run.bind(h.git);
  h.git.run = (args, cwd): Promise<GitResult> => {
    calls.push([...args]);
    if (args[0] === "log") return Promise.resolve({ code: 0, stdout: state.log, stderr: "" });
    if (args[0] === "status") {
      const paths = h.store.exists(ARCHIVE) ? [`.bdk/changes/archive/${CHANGE}/change.md`] : [];
      return Promise.resolve({
        code: 0,
        stdout: paths.map((path) => `?? ${path}\0`).join(""),
        stderr: "",
      });
    }
    if (args[0] === "rev-parse")
      return Promise.resolve({ code: 0, stdout: "a1b2c3d4\n", stderr: "" });
    return base(args, cwd);
  };
  return state;
}

async function close(h: Harness, ...flags: string[]) {
  return h.run(["change", "close", ...flags, "--json"], T1);
}

function refusal(json: unknown): { rule: string; why: string } {
  return json as { rule: string; why: string };
}

describe("change close refusals, in contract order, writing nothing", () => {
  it("policy/gate-not-ready before gate:review", async () => {
    const h = closing({ gate: "none" });
    const result = await close(h);
    expect(result.code).toBe(2);
    expect(refusal(result.json).rule).toBe("policy/gate-not-ready");
    expect(h.store.exists(DIR)).toBe(true);
  });

  it("policy/ticket-open with a ticket open", async () => {
    const h = closing();
    writeDocument(h.store, `${DIR}/attempts/task-redispatch-01-1-A-00000001.md`, {
      data: {
        schema: 1,
        ticket: "A-00000001",
        loop: "task-redispatch",
        target: "01-1",
        attempt: 1,
        of: 3,
        scope: "full",
        "opened-at": T0,
        author: AUTHOR,
      },
      body: "",
    });
    const result = await close(h);
    expect(refusal(result.json).rule, result.stdout).toBe("policy/ticket-open");
  });

  it("policy/undecided-entries after the open tickets, naming the entry and /bdk:cr --report", async () => {
    const h = closing();
    const id = writeEntry(h.store, {
      type: "finding",
      at: T0,
      status: "proposed",
      level: "should-fix",
      summary: "Token not hashed",
    });
    writeEntry(h.store, {
      type: "observation",
      at: T0,
      level: "nice-to-have",
      disposition: "defer",
    });
    for (const flags of [[], ["--dry-run"]]) {
      const result = await close(h, ...flags);
      expect(result.code, result.stdout).toBe(2);
      const error = result.json as { rule: string; why: string; instead: string[] };
      expect(error.rule).toBe("policy/undecided-entries");
      expect(error.why).toContain(id);
      expect(error.why).not.toContain("observation");
      expect(error.instead.join(" ")).toContain("/bdk:cr --report");
    }
    expect(h.store.exists(ARCHIVE)).toBe(false);
  });

  it("policy/undecided-entries for an entry decided fix and not fixed yet", async () => {
    const h = closing();
    const id = writeEntry(h.store, {
      type: "blocker",
      at: T0,
      level: "blocker",
      disposition: "fix",
    });
    const result = await close(h);
    expect(refusal(result.json).rule, result.stdout).toBe("policy/undecided-entries");
    expect(refusal(result.json).why).toContain(id);
  });

  it("state/trailer-mismatch when a commit names a task no part holds", async () => {
    const h = closing();
    h.log = `c0ffee00\x1fp0\x1fTask\x1f${CHANGE}\x1f01\x1f01-9\x1e`;
    const result = await close(h);
    expect(result.code).toBe(4);
    expect(refusal(result.json)).toMatchObject({
      rule: "state/trailer-mismatch",
      why: expect.stringContaining("01-9") as unknown,
    });
  });

  it("the merge's checks: an invalid delta refuses policy/spec-invalid", async () => {
    const h = closing();
    h.store.write(`${DIR}/spec-delta/auth/login.md`, "## ADDED Requirements\n");
    const result = await close(h);
    expect(refusal(result.json).rule).toBe("policy/spec-invalid");
    expect(h.store.exists(SPEC)).toBe(false);
    expect(h.store.exists(DIR)).toBe(true);
  });

  it("the merge's checks: a hand-edited spec refuses policy/merge-hash-mismatch", async () => {
    const h = closing();
    h.store.write(`${DIR}/spec-delta/auth/login.md`, DELTA);
    h.store.write(SPEC, "# auth/login Specification\n\nEdited by hand.\n");
    const result = await close(h);
    expect(refusal(result.json).rule).toBe("policy/merge-hash-mismatch");
  });
});

describe("change close", () => {
  it("--dry-run reports the merge and the archive path and writes nothing", async () => {
    const h = closing();
    h.store.write(`${DIR}/spec-delta/auth/login.md`, DELTA);
    const logs = h.store.list(`${DIR}/log`);
    const result = await close(h, "--dry-run");
    expect(result.code).toBe(0);
    expect(changeCloseOutput.parse(result.json)).toMatchObject({
      change: CHANGE,
      archivedTo: `.bdk/changes/archive/${CHANGE}`,
      spec: { merged: ["auth/login"], unchanged: false },
    });
    expect(h.store.exists(SPEC)).toBe(false);
    expect(h.store.exists(ARCHIVE)).toBe(false);
    expect(h.store.list(`${DIR}/log`)).toStrictEqual(logs);
    expect(h.calls.some((args) => args[0] === "commit")).toBe(false);
  });

  it("merges, writes the close transition, prunes, archives, unbinds and commits", async () => {
    const h = closing();
    h.store.write(`${DIR}/spec-delta/auth/login.md`, DELTA);
    writePackage(h.store, "A-00000001", "implementer", "01-1");
    h.store.write(`${DIR}/reports/review-reviewer-A-00000002.md`, "report\n");
    const result = await close(h);
    expect(result.code, result.stdout).toBe(0);
    expect(changeCloseOutput.parse(result.json).spec).toStrictEqual({
      merged: ["auth/login"],
      unchanged: false,
    });
    expect(h.store.read(SPEC)).toContain(`bdk-change: ${CHANGE}`);
    expect(h.store.exists(DIR)).toBe(false);
    expect(h.store.list(`${ARCHIVE}/dispatch`)).toStrictEqual(["pruned.md"]);
    expect(h.store.list(`${ARCHIVE}/reports`)).toStrictEqual(["pruned.md"]);
    expect(h.store.list(`${ARCHIVE}/log`).some((name) => name.includes("-transition-"))).toBe(true);
    const transition = h.store
      .list(`${ARCHIVE}/log`)
      .map((name) => h.store.read(`${ARCHIVE}/log/${name}`) ?? "")
      .filter((text) => text.includes("to: close"));
    expect(transition.map((text) => /source: (\S+)/.exec(text)?.[1])).toStrictEqual([
      "user",
      "kernel",
    ]);
    expect(readMarker(h.store, ROOT, BRANCH)).toBeUndefined();
    const commit = h.calls.find((args) => args[0] === "commit");
    expect(commit).toStrictEqual([
      "commit",
      "--quiet",
      "--only",
      "-m",
      `chore(bdk): close ${CHANGE}`,
      "-m",
      `BDK-Change: ${CHANGE}`,
      "--",
      `.bdk/changes/archive/${CHANGE}/change.md`,
    ]);
    const list = await h.run(["change", "list", "--all", "--json"], T1);
    expect(list.json).toMatchObject({
      items: [{ change: CHANGE, state: "archived", stage: "close" }],
    });
  });

  it("keeps the evidence bodies with archive.keep-evidence", async () => {
    const h = closing();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "archive:\n  keep-evidence: true\n");
    writePackage(h.store, "A-00000001", "implementer", "01-1");
    const result = await close(h);
    expect(result.code, result.stdout).toBe(0);
    expect(h.store.list(`${ARCHIVE}/dispatch`)).toStrictEqual(["01-1-implementer-A-00000001.md"]);
  });

  it("proposes no rule: learnings keep their status and no rule file is written", async () => {
    const h = closing();
    const learning = {
      type: "learning",
      at: T0,
      status: "proposed",
      summary: "Scoped runs must include the negative case",
      fingerprint: `sha256:${"b".repeat(64)}`,
      applies: ["**/*.test.ts"],
    };
    const first = writeEntry(h.store, learning);
    const second = writeEntry(h.store, learning);
    const result = await close(h);
    expect(result.code, result.stdout).toBe(0);
    expect(result.json).not.toHaveProperty("learning");
    const archived = h.store
      .list(`${ARCHIVE}/log`)
      .filter((name) => name.includes(first) || name.includes(second))
      .map((name) => h.store.read(`${ARCHIVE}/log/${name}`) ?? "");
    expect(archived).toHaveLength(2);
    for (const text of archived) expect(text).toContain("status: proposed");
    expect(h.store.exists(`${ROOT}/.bdk/rules`)).toBe(false);
    expect(h.store.exists(`${ROOT}/.claude/rules`)).toBe(false);
  });

  it("builds the PR summary from the live ledger; no delta is spec.unchanged", async () => {
    const h = closing({ gate: "policy" });
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "policy:\n  gates:\n    review: auto\n");
    writeEntry(h.store, { type: "decision", at: T0, summary: "Links expire after 15 minutes" });
    const old = writeEntry(h.store, { type: "assumption", at: T0, summary: "Old assumption" });
    writeEntry(h.store, {
      type: "assumption",
      at: T0,
      summary: "Mail arrives within a minute",
      supersedes: old,
    });
    writeEntry(h.store, { type: "risk", at: T0, summary: "Mail may be delayed" });
    writeEntry(h.store, {
      type: "finding",
      at: T0,
      summary: "Token not hashed",
      disposition: "defer",
      review: true,
    });
    writeEntry(h.store, {
      type: "observation",
      at: T0,
      summary: "Dates built by hand",
      disposition: "track",
      issue: "https://github.com/acme/app/issues/88",
    });
    writeEntry(h.store, {
      type: "finding",
      at: T0,
      status: "resolved",
      summary: "Fixed finding",
    });
    const result = await close(h, "--dry-run");
    expect(result.code, result.stdout).toBe(0);
    const report = changeCloseOutput.parse(result.json);
    expect(report.spec).toStrictEqual({ merged: [], unchanged: true });
    expect(report.gatesByPolicy).toStrictEqual(["gate:review"]);
    expect(report.summary).toMatch(/^## Users log in with a one-time link\.\n/);
    expect(report.summary).toContain("### Decisions\n\n- Links expire after 15 minutes (");
    expect(report.summary).toContain("- Mail arrives within a minute (");
    expect(report.summary).not.toContain("Old assumption");
    expect(report.summary).toContain("### Risks\n\n- Mail may be delayed (");
    expect(report.summary).toContain(
      "### Open findings\n\n- Token not hashed (deferred, to be reviewed) (",
    );
    expect(report.summary).toContain(
      "- Dates built by hand (tracked in https://github.com/acme/app/issues/88) (",
    );
    expect(report.summary).not.toContain("Fixed finding");
    expect(report.summary).toContain("### Spec\n\nNo spec change.");
  });
});
