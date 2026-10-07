// `bdk check run` in memory (`kernel-cli/check`; #166): the part harness with
// the check, attempt and evidence commands and a shell whose answer per
// command a test sets, so the composition, the verdicts, the commit command
// and every refusal are checked without running a project command.
import { describe, expect, it } from "vitest";

import { attemptRegistrations } from "../../attempt/index.ts";
import { evidenceRegistrations } from "../../evidence/index.ts";
import { setChange, writePlanPart } from "../../graph/tests/support.ts";
import { ROOT, TOOL_SETTINGS } from "../../log/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { harness as partHarness, openTicket, tasks } from "../../part/tests/support.ts";
import type { Harness as PartHarness } from "../../part/tests/support.ts";
import type { CommandRun } from "../../shared/git/index.ts";
import { checkRegistrations } from "../index.ts";

const CHANGE = "2026-09-25-login";
const TICKET = "A-0000part";
const ROUND = "A-000round";

interface Harness extends PartHarness {
  /** What the shell answers for a command; exit 0 with no output when unset. */
  readonly answers: Map<string, Partial<CommandRun>>;
  /** Every command the shell ran, with its working directory. */
  readonly ran: { command: string; cwd: string; timeoutMs: number }[];
}

function harness(): Harness {
  const answers = new Map<string, Partial<CommandRun>>();
  const ran: Harness["ran"] = [];
  const h = partHarness((deps) => [
    ...attemptRegistrations(deps),
    ...evidenceRegistrations(deps),
    ...checkRegistrations({
      ...deps,
      shell: (command, cwd, timeoutMs) => {
        ran.push({ command, cwd, timeoutMs });
        return Promise.resolve({
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
          output: "",
          ...answers.get(command),
        });
      },
    }),
  ]);
  return { ...h, answers, ran };
}

/**
 * A tiny Change whose plan is done: part 01 holds tasks 01-1 and 01-2
 * (`src/01-<n>.ts`) and task 01-3 (`docs/01-3.md`, nothing executable), with
 * do-not-touch `src/billing/**`; a `part 01` ticket is open.
 */
async function started(settings = ""): Promise<Harness> {
  const h = harness();
  h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOL_SETTINGS + settings);
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01", {
    body:
      tasks("01", 2) +
      "\n## 01-3 Document\n\n**Files:**\n\n- `docs/01-3.md`\n\n**Test cases:**\n\n- documented\n",
    doNotTouch: ["src/billing/**"],
  });
  writePlanPart(h.store, "02", { body: tasks("02", 1), dependsOn: ["01"] });
  const done = await h.run(["done", "plan", "--json"]);
  expect(done.code, done.stdout).toBe(0);
  openTicket(h.store, TICKET, "01");
  return h;
}

/** Writes `path` in the store and reports it as changed in the working tree. */
function touch(h: Harness, path: string): void {
  h.store.write(`${ROOT}/${path}`, `export const at = "${path}";\n`);
  h.git.status.push(path);
}

function check(h: Harness, target: string, ...flags: string[]): Promise<RunResult> {
  return h.run(["check", "run", target, "--ticket", TICKET, ...flags, "--json"]);
}

interface Report {
  verdict: string;
  checks: { kind: string; tool: string; verdict: string; file: string; tail?: string[] }[];
  evidence: Record<string, string>;
  commit?: { paths: string[]; command: string };
}

async function report(h: Harness, target: string, ...flags: string[]): Promise<Report> {
  const result = await check(h, target, ...flags);
  expect(result.code, result.stdout).toBe(0);
  return result.json as Report;
}

function refusal(result: RunResult): { rule: string; why: string; instead: string[] } {
  return result.json as { rule: string; why: string; instead: string[] };
}

describe("bdk check run", () => {
  it("runs each kind's commands on the task's files and prints the task's commit", async () => {
    const h = await started();
    touch(h, "src/01-1.ts");
    const answer = await report(h, "01-1");
    expect(h.ran.map((run) => [run.command, run.cwd])).toStrictEqual([
      ["vitest run", ROOT],
      ["eslint .", ROOT],
    ]);
    expect(answer).toMatchObject({
      verdict: "pass",
      checks: [
        { kind: "tests-scoped", tool: "unit", verdict: "pass" },
        { kind: "lint", tool: "eslint", verdict: "pass" },
      ],
    });
    expect(Object.keys(answer.evidence)).toStrictEqual(["tests-scoped", "lint"]);
    expect(h.store.read(`${ROOT}/${answer.checks[0]?.file ?? ""}`)).toBe("exit 0\n");
    expect(answer.commit).toStrictEqual({
      paths: ["src/01-1.ts"],
      command:
        `git add -- src/01-1.ts && git commit -m 'Task 1' --trailer 'BDK-Change: ${CHANGE}' ` +
        "--trailer 'BDK-Part: 01' --trailer 'BDK-Task: 01-1' -- src/01-1.ts",
    });
  });

  it("prints the text form: one line per check and the commit command last", async () => {
    const h = await started();
    touch(h, "src/01-1.ts");
    const result = await h.run(["check", "run", "01-1", "--ticket", TICKET]);
    expect(result.code, result.stdout).toBe(0);
    expect(result.stdout).toContain("tests-scoped");
    expect(result.stdout.trimEnd().split("\n").at(-1)).toContain("git commit");
  });

  it("prints a failing check's tail, a skipped entry, a timeout and the undeclared paths", async () => {
    const h = await started();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      TOOL_SETTINGS.replace(
        "  lint:",
        "    - { id: pytest, tier: fast, command: pytest, when: only for Python files }\n  lint:",
      ),
    );
    touch(h, "src/01-1.ts");
    touch(h, "src/other.ts");
    h.answers.set("vitest run", { exitCode: 1, output: "boom\n" });
    h.answers.set("eslint .", { exitCode: undefined, timedOut: true });
    const result = await h.run(["check", "run", "01-1", "--ticket", TICKET, "--skip", "pytest"]);
    expect(result.code, result.stdout).toBe(0);
    expect(result.stdout).toContain("tests-scoped unit: fail (exit 1)");
    expect(result.stdout).toContain("  | boom");
    expect(result.stdout).toContain(
      "tests-scoped pytest: not-run (skipped: only for Python files)",
    );
    expect(result.stdout).toContain("lint eslint: fail (timeout 300 s)");
    expect(result.stdout).toContain("undeclared: src/other.ts");
    expect(result.stdout).not.toContain("commit:");
  });

  it("fills {files} with the target's executable files in byte order", async () => {
    const h = await started();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "tools:\n  test:\n    - { id: unit, tier: fast, command: vitest, related: 'vitest related {files}' }\n" +
        "    - { id: e2e, tier: e2e, command: playwright }\n" +
        "  lint:\n    - { id: eslint, tier: lint, command: eslint, scoped: 'eslint {files}' }\n",
    );
    await report(h, "01");
    expect(h.ran.map((run) => run.command)).toStrictEqual([
      "vitest related src/01-1.ts src/01-2.ts",
      "eslint src/01-1.ts src/01-2.ts",
    ]);
  });

  it("fails a kind on a non-zero exit with the output's tail and prints no commit", async () => {
    const h = await started();
    touch(h, "src/01-1.ts");
    const lines = Array.from({ length: 30 }, (_, at) => `line ${String(at + 1)}`);
    h.answers.set("vitest run", { exitCode: 1, output: lines.join("\n") });
    const answer = await report(h, "01-1");
    expect(answer.verdict).toBe("fail");
    expect(answer.checks[0]).toMatchObject({ verdict: "fail", tail: lines.slice(10) });
    expect(h.store.read(`${ROOT}/${answer.checks[0]?.file ?? ""}`)).toBe(
      `${lines.join("\n")}\nexit 1\n`,
    );
    expect(answer).not.toHaveProperty("commit");
  });

  it("fails a command killed at the timeout and passes the bound in milliseconds", async () => {
    const h = await started();
    h.answers.set("vitest run", { exitCode: undefined, timedOut: true, output: "slow\n" });
    const answer = await report(h, "01-1");
    expect(h.ran[0]?.timeoutMs).toBe(300_000);
    expect(answer.checks[0]).toMatchObject({ timeout: 300, verdict: "fail" });
    expect(h.store.read(`${ROOT}/${answer.checks[0]?.file ?? ""}`)).toBe("slow\ntimeout 300\n");
  });

  it("does not run a tool that is not installed (exit 127)", async () => {
    const h = await started();
    h.answers.set("eslint .", { exitCode: 127 });
    const answer = await report(h, "01-1");
    expect(answer.checks[1]).toMatchObject({ verdict: "not-run" });
    expect(answer.verdict).toBe("pass");
  });

  it("runs nothing for a task with no executable file", async () => {
    const h = await started();
    const answer = await report(h, "01-3");
    expect(h.ran).toStrictEqual([]);
    expect(answer.verdict).toBe("not-run");
    expect(answer.checks).toStrictEqual([]);
    expect(h.store.read(`${ROOT}/.bdk/.machine/checks/${TICKET}/01-3-tests-scoped-none.txt`)).toBe(
      "not-run: 01-3 has no executable file\n",
    );
  });

  it("runs nothing for a kind with no command", async () => {
    const h = await started();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "tools:\n  test:\n    - { id: e2e, tier: e2e, command: playwright }\n" +
        "  lint:\n    - { id: eslint, tier: lint, command: eslint . }\n",
    );
    await report(h, "01-1");
    expect(h.ran.map((run) => run.command)).toStrictEqual(["eslint ."]);
    expect(h.store.read(`${ROOT}/.bdk/.machine/checks/${TICKET}/01-1-tests-scoped-none.txt`)).toBe(
      "not-run: no command is configured for tests-scoped\n",
    );
  });

  it("skips an entry whose when does not apply; refuses one without when or unknown", async () => {
    const h = await started();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      TOOL_SETTINGS.replace(
        "  lint:",
        "    - { id: pytest, tier: fast, command: pytest, when: only for Python files }\n  lint:",
      ),
    );
    const answer = await report(h, "01-1", "--skip", "pytest");
    expect(h.ran.map((run) => run.command)).toStrictEqual(["vitest run", "eslint ."]);
    expect(answer.checks).toContainEqual(
      expect.objectContaining({ tool: "pytest", skipped: "only for Python files" }),
    );
    expect(
      h.store.read(`${ROOT}/.bdk/.machine/checks/${TICKET}/01-1-tests-scoped-pytest.txt`),
    ).toBe("skipped: only for Python files\n");

    for (const [skip, why] of [
      ["unit", "--skip unit: the entry has no when"],
      ["nope", "--skip nope: no tools.test or tools.lint entry is nope"],
    ] as const) {
      const result = await check(h, "01-1", "--skip", skip);
      expect(result.code, result.stdout).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/invalid-argument" });
      expect(refusal(result).why).toContain(why);
    }
  });

  it("prints a part's conform commit with the ticket's trailer", async () => {
    const h = await started();
    touch(h, "src/01-2.ts");
    const answer = await report(h, "01");
    expect(answer.commit?.command).toBe(
      `git add -- src/01-2.ts && git commit -m 'refactor(01): conform part 01' --trailer 'BDK-Change: ${CHANGE}' ` +
        `--trailer 'BDK-Part: 01' --trailer 'BDK-Ticket: ${TICKET}' -- src/01-2.ts`,
    );
  });

  it("quotes a path that is not a safe shell word", async () => {
    const h = await started();
    writePlanPart(h.store, "01", {
      body: "## 01-1 Quote it\n\n**Files:**\n\n- `src/it's.ts`\n\n**Test cases:**\n\n- works\n",
    });
    touch(h, "src/it's.ts");
    const answer = await report(h, "01-1");
    expect(answer.commit?.command).toContain(`git add -- 'src/it'\\''s.ts'`);
  });

  it("prints no commit while a merge is in progress or nothing is touched", async () => {
    const h = await started();
    expect(await report(h, "01")).not.toHaveProperty("commit");
    touch(h, "src/01-1.ts");
    h.git.merging = true;
    expect(await report(h, "01")).not.toHaveProperty("commit");
  });

  it("refuses a forbidden path with policy/do-not-touch before any command runs", async () => {
    const h = await started();
    touch(h, "src/billing/invoice.ts");
    const result = await check(h, "01-1");
    expect(result.code, result.stdout).toBe(2);
    expect(refusal(result).rule).toBe("policy/do-not-touch");
    expect(h.ran).toStrictEqual([]);
  });

  it("checks a review round's fix over the Change and prints no commit", async () => {
    const h = await started();
    openTicket(h.store, ROUND, CHANGE, "review-fix");
    touch(h, "src/02-1.ts");
    const result = await h.run(["check", "run", CHANGE, "--ticket", ROUND, "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(h.ran.map((run) => run.command)).toStrictEqual(["vitest run", "eslint ."]);
    expect(result.json).toMatchObject({ target: CHANGE, verdict: "pass" });
    expect(result.json).not.toHaveProperty("commit");

    const part = await h.run(["check", "run", "01", "--ticket", ROUND, "--json"]);
    expect(part.code, part.stdout).toBe(3);
    expect(refusal(part)).toMatchObject({
      rule: "input/invalid-argument",
      instead: [`bdk check run ${CHANGE} --ticket ${ROUND}`],
    });
  });

  it("refuses a ticket that is unknown, closed or of a loop that runs no checks", async () => {
    const h = await started();
    openTicket(h.store, "A-verifier", "design", "verifier");
    const unknown = await h.run(["check", "run", "01-1", "--ticket", "A-zzzzzzzz", "--json"]);
    expect(refusal(unknown)).toMatchObject({ rule: "policy/no-open-ticket" });
    expect(refusal(unknown).why).toContain("has no ticket A-zzzzzzzz");
    const verifier = await h.run(["check", "run", "01-1", "--ticket", "A-verifier", "--json"]);
    expect(refusal(verifier).why).toContain("is a verifier ticket");
    const closed = await h.run([
      "attempt",
      "close",
      TICKET,
      "not-run",
      "--reason",
      "no runner",
      "--json",
    ]);
    expect(closed.code, closed.stdout).toBe(0);
    const again = await check(h, "01-1");
    expect(again.code, again.stdout).toBe(2);
    expect(refusal(again).why).toContain("is already closed not-run");
    expect(h.ran).toStrictEqual([]);
  });

  it("refuses a malformed, unknown or foreign target", async () => {
    const h = await started();
    const cases: [string, string, string][] = [
      ["login", "input/invalid-argument", "login is neither a task nor a part id"],
      ["01-9", "input/not-found", "has no plan task 01-9"],
      ["09", "input/not-found", "has no plan part 09"],
      ["02-1", "input/invalid-argument", "works on part 01; 02-1 belongs to part 02"],
    ];
    for (const [target, rule, why] of cases) {
      const result = await check(h, target);
      expect(refusal(result), target).toMatchObject({ rule });
      expect(refusal(result).why).toContain(why);
    }
    expect(h.ran).toStrictEqual([]);
  });
});
