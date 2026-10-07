// The attempt tests' repository in memory: the part harness with the attempt
// commands, a tiny Change whose plan is done, and helpers for the entries a
// role writes under a ticket and the report envelope it returns.
import { expect } from "vitest";

import { setChange, writeEntry, writePlanPart } from "../../graph/tests/support.ts";
import { ROOT, TOOL_SETTINGS } from "../../log/tests/support.ts";
import { harness as partHarness, tasks } from "../../part/tests/support.ts";
import type { Harness as PartHarness } from "../../part/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { evidenceRegistrations } from "../../evidence/index.ts";
import { stampPackage, writeDocument } from "../../shared/store/index.ts";
import { attemptRegistrations } from "../index.ts";
import { DIR } from "../../part/tests/support.ts";

export { DIR };

export interface Harness extends PartHarness {
  /** Runs at the next minute, so records and entries keep their order. */
  step(argv: readonly string[]): Promise<RunResult>;
}

export function harness(): Harness {
  const h = partHarness((deps) => [...attemptRegistrations(deps), ...evidenceRegistrations(deps)]);
  let minute = 0;
  return {
    ...h,
    step: (argv) => {
      minute++;
      return h.run(argv, `2026-09-25T11:${String(minute).padStart(2, "0")}:00Z`);
    },
  };
}

/**
 * A tiny Change whose plan is done: part 01 (tasks 01-1, 01-2; do-not-touch
 * `src/billing/**`) started, part 02 (task 02-1) after it.
 */
export async function started(settings?: string): Promise<Harness> {
  const h = harness();
  if (settings !== undefined) h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOL_SETTINGS + settings);
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: tasks("01", 2), doNotTouch: ["src/billing/**"] });
  writePlanPart(h.store, "02", { body: tasks("02", 1), dependsOn: ["01"] });
  const done = await h.run(["done", "plan", "--json"], "2026-09-25T10:00:00.000Z");
  expect(done.code, done.stdout).toBe(0);
  const start = await h.run(["part", "start", "01", "--json"], "2026-09-25T10:01:00.000Z");
  expect(start.code, start.stdout).toBe(0);
  return h;
}

/** `attempt open --json`; the ticket on exit 0. */
export async function open(h: Harness, loop: string, target: string, ...flags: string[]) {
  const result = await h.step(["attempt", "open", loop, target, ...flags, "--json"]);
  return { ...result, ticket: (result.json as { ticket?: string }).ticket ?? "" };
}

export function close(h: Harness, ticket: string, outcome: string, ...flags: string[]) {
  return h.step(["attempt", "close", ticket, outcome, ...flags, "--json"]);
}

/** Opens a ticket and closes it with each outcome in turn, asserting exit 0. */
export async function cycle(
  h: Harness,
  loop: string,
  target: string,
  outcome: string,
  finding?: { summary: string; refs: string[]; severity?: string },
): Promise<{ ticket: string; close: RunResult }> {
  const opened = await open(h, loop, target);
  expect(opened.code, opened.stdout).toBe(0);
  if (finding !== undefined) underTicket(h, opened.ticket, finding);
  if (outcome === "ok" && loop === "part") await delivered(h, opened.ticket);
  const reason = outcome === "not-run" ? ["--reason", "no test runner"] : [];
  const closed = await close(h, opened.ticket, outcome, ...reason);
  expect(closed.code, closed.stdout).toBe(0);
  return { ticket: opened.ticket, close: closed };
}

/** An entry a role wrote under `ticket` (`log add --ticket`, `log ingest --ticket`). */
export function underTicket(
  h: Harness,
  ticket: string,
  fields: { summary: string; refs: string[]; severity?: string; type?: string },
): string {
  return writeEntry(h.store, {
    type: fields.type ?? "finding",
    at: "2026-09-25T11:30:00.000Z",
    summary: fields.summary,
    refs: fields.refs,
    status: "proposed",
    source: "agent:implementer",
    ticket,
    ...(fields.severity === undefined ? {} : { severity: fields.severity }),
  });
}

/** The report envelope of `ticket` declaring `entries`; its path relative to the project root. */
export function envelope(h: Harness, ticket: string, entries: string[]): string {
  const file = `reports/01-implementer-${ticket}.md`;
  writeDocument(h.store, `${DIR}/${file}`, {
    data: {
      schema: 1,
      ticket,
      role: "implementer",
      status: "done",
      files: ["src/01-1.ts"],
      entries,
      evidence: [],
    },
    body: "",
  });
  return `.bdk/changes/2026-09-25-login/${file}`;
}

const REL = ".bdk/changes/2026-09-25-login";

/** The package `dispatch build` writes for `role`, stamped as the ticket's active one. */
export function packaged(h: Harness, ticket: string, role: string, target = "01"): void {
  const path = `${REL}/dispatch/${target}-${role}-${ticket}.md`;
  writeDocument(h.store, `${ROOT}/${path}`, {
    data: {
      schema: 1,
      ticket,
      target,
      role,
      adapter: role === "implementer" || role === "conformer" ? "worker" : "reader",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T11:00:30.000Z",
      "kernel-version": "3.0.0",
      "template-hash": `sha256:${"0".repeat(64)}`,
      report: `${REL}/reports/${target}-${role}-${ticket}.md`,
      draft: `.bdk/.machine/drafts/${target}-${role}-${ticket}.md`,
      rules: [],
    },
    body: "",
  });
  stampPackage(h.store, DIR, ticket, path);
}

/** The conformer's package and its stored report with `status`. */
export function conformed(h: Harness, ticket: string, status = "done", target = "01"): void {
  packaged(h, ticket, "conformer", target);
  writeDocument(h.store, `${DIR}/reports/${target}-conformer-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      role: "conformer",
      status,
      files: [],
      entries: [],
      evidence: [],
      ...(status === "blocked" || status === "needs-context" ? { reason: "no diff to read" } : {}),
    },
    body: "# Conform\n\n## Conformance\n\n- BDK-CQ-1: yes\n",
  });
}

/** `evidence record <kind>` under `ticket` with `verdict`, citing the result unless `cite` is false. */
export async function recorded(
  h: Harness,
  ticket: string,
  kind: string,
  verdict = "pass",
  cite = true,
): Promise<string> {
  const file = `.bdk/.machine/checks/${ticket}/${kind}.json`;
  h.store.write(`${ROOT}/${file}`, `{"failed":${verdict === "fail" ? "1" : "0"}}\n`);
  const result = await h.step([
    "evidence",
    "record",
    kind,
    file,
    "--ticket",
    ticket,
    "--verdict",
    verdict,
    ...(cite ? ["--cite", "/failed"] : []),
    "--json",
  ]);
  expect(result.code, result.stdout).toBe(0);
  return (result.json as { evidence: string }).evidence;
}

/** A part ticket whose conformer report and check evidence all passed. */
async function stepsDone(h: Harness, ticket: string, target = "01"): Promise<void> {
  packaged(h, ticket, "implementer", target);
  conformed(h, ticket, "done", target);
  await recorded(h, ticket, "tests-scoped");
  await recorded(h, ticket, "lint");
}

/** A trailer commit of each task of part 01 under `ticket`, as `bdk check run` prints it. */
export function tasksCommitted(h: Harness, ticket: string): void {
  h.git.commits = [
    ["c0ffee2", "01", "01-2", ticket],
    ["c0ffee1", "01", "01-1", ticket],
  ];
}

/** `stepsDone` and `tasksCommitted`: an `ok` close of the part ticket holds. */
export async function delivered(h: Harness, ticket: string): Promise<void> {
  await stepsDone(h, ticket);
  tasksCommitted(h, ticket);
}
