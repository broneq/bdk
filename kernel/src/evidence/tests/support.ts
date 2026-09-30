// The evidence tests' repository in memory: a tiny Change whose part 01
// (tasks 01-1 and 01-2 declaring `src/01-<k>.ts`) is started, driven through
// the attempt and evidence commands, with a git whose work-tree file list a
// test sets and helpers for the files a runner records.
import { expect } from "vitest";

import { attemptRegistrations } from "../../attempt/index.ts";
import { setChange, writePlanPart } from "../../graph/tests/support.ts";
import { ROOT } from "../../log/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { harness as partHarness, tasks } from "../../part/tests/support.ts";
import type { Harness as PartHarness } from "../../part/tests/support.ts";
import { DIR } from "../../part/tests/support.ts";
import { stampPackage, writeDocument } from "../../shared/store/index.ts";
import { evidenceRegistrations } from "../index.ts";

export { DIR, ROOT };
/** The Change directory relative to the project root. */
export const REL = ".bdk/changes/2026-09-25-login";

export interface Harness extends PartHarness {
  /** The paths `git ls-files -co --exclude-standard` answers, relative to the root. */
  readonly files: string[];
  /** Runs at the next minute, so records and manifests keep their order. */
  step(argv: readonly string[]): Promise<RunResult>;
  /** Writes a file relative to the project root and lists it in the work tree. */
  put(path: string, content: string | Uint8Array): void;
}

function harness(): Harness {
  const h = partHarness((deps) => [...attemptRegistrations(deps), ...evidenceRegistrations(deps)]);
  const files: string[] = [];
  const run = h.git.run.bind(h.git);
  h.git.run = (args, cwd) =>
    args[0] === "ls-files"
      ? Promise.resolve({ code: 0, stdout: files.map((path) => `${path}\0`).join(""), stderr: "" })
      : run(args, cwd);
  let minute = 0;
  return {
    ...h,
    files,
    step: (argv) => {
      minute++;
      return h.run(argv, `2026-09-25T11:${String(minute).padStart(2, "0")}:00Z`);
    },
    put(path, content) {
      const full = `${ROOT}/${path}`;
      if (typeof content === "string") h.store.write(full, content);
      else h.store.writeBytes(full, content);
      if (!files.includes(path)) files.push(path);
    },
  };
}

/**
 * Part 01 (tasks 01-1, 01-2, or `body01`) started, part 02 (task 02-1) after
 * it; the source files exist.
 */
export async function started(body01 = tasks("01", 2)): Promise<Harness> {
  const h = harness();
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", { body: body01 });
  writePlanPart(h.store, "02", { body: tasks("02", 1), dependsOn: ["01"] });
  for (const path of ["src/01-1.ts", "src/01-2.ts", "src/02-1.ts"]) h.put(path, `// ${path}\n`);
  const done = await h.run(["done", "plan", "--json"], "2026-09-25T10:00:00.000Z");
  expect(done.code, done.stdout).toBe(0);
  const start = await h.run(["part", "start", "01", "--json"], "2026-09-25T10:01:00.000Z");
  expect(start.code, start.stdout).toBe(0);
  return h;
}

/** Opens a `task-redispatch` ticket of `task`; answers the ticket. */
export async function ticketOf(h: Harness, task = "01-1"): Promise<string> {
  const opened = await h.step(["attempt", "open", "task-redispatch", task, "--json"]);
  expect(opened.code, opened.stdout).toBe(0);
  return (opened.json as { ticket: string }).ticket;
}

export function record(h: Harness, ...argv: string[]): Promise<RunResult> {
  return h.step(["evidence", "record", ...argv, "--json"]);
}

export function check(h: Harness, target: string, json = true): Promise<RunResult> {
  return h.step(["evidence", "check", target, ...(json ? ["--json"] : [])]);
}

export function refusal(result: RunResult) {
  return result.json as { rule: string; why: string; instead: string[] };
}

/** A dispatch package of `role` for `ticket`, stamped on its attempt record as `dispatch build` does. */
export function withPackage(h: Harness, ticket: string, role: string, target = "01-1"): void {
  const path = `${REL}/dispatch/${target}-${role}-${ticket}.md`;
  writeDocument(h.store, `${ROOT}/${path}`, {
    data: {
      schema: 1,
      ticket,
      target,
      role,
      adapter: role === "runner" ? "runner" : "worker",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T11:00:00.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `${REL}/reports/${target}-${role}-${ticket}.md`,
      rules: [],
      "rules-truncated": 0,
    },
    body: "",
  });
  expect(stampPackage(h.store, DIR, ticket, path)).toBe(true);
}
