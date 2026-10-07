// `kernel-cli/check` (#166) through the built bundle in real repositories:
// `bdk check run` runs the project's commands with stdin closed and a
// timeout, writes their outputs under the ticket's own directory, records one
// kernel manifest per kind and prints the commit command, which commits the
// task with the trailers the part's progress reads.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  bdkOpenStdin,
  git,
  ingestArgs,
  refused,
  repository,
  shell,
} from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";

interface Started {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
  readonly ticket: string;
}

interface Check {
  readonly kind: string;
  readonly tool: string;
  readonly command: string;
  readonly exit?: number;
  readonly timeout?: number;
  readonly skipped?: string;
  readonly verdict: string;
  readonly file: string;
  readonly tail?: string[];
}

interface CheckRun {
  readonly verdict: string;
  readonly checks: Check[];
  readonly evidence: Record<string, string>;
  readonly diff: { declared: string[]; touched: string[]; undeclared: string[] };
  readonly commit?: { paths: string[]; command: string };
}

const TEST = "echo tested {files}";
const LINT = "cat";

function settings(test: string, lint: string, extra = ""): string {
  return (
    "tools:\n" +
    `  test:\n    - { id: unit, tier: fast, command: ${JSON.stringify(test)} }\n${extra}` +
    `  lint:\n    - { id: eslint, tier: lint, command: ${JSON.stringify(lint)} }\n`
  );
}

/**
 * A tiny Change whose part 01 holds task 01-1 (`src/01-1.ts`) and task 01-2
 * (`docs/01-2.md`, nothing executable), started, with a `part` ticket open.
 */
function started(projectSettings = settings(TEST, LINT)): Started {
  const root = repository({ ".bdk/settings.yaml": projectSettings });
  const created = bdk(
    ["change", "new", "Greet the user", "--profile", "tiny", "--reason", "a greeting", "--json"],
    root,
  );
  expect(created.code, created.stdout).toBe(0);
  const id = (created.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  fileStore().write(
    join(dir, "plan/parts/01-part.md"),
    '---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\n' +
      'do-not-touch: ["src/billing/**"]\ndepends-on: []\nspec-impact: none\n---\n' +
      "## 01-1 Greet\n\n**Files:**\n\n- `src/01-1.ts`\n\n**Test cases:**\n\n- greets\n\n" +
      "## 01-2 Document\n\n**Files:**\n\n- `docs/01-2.md`\n\n**Test cases:**\n\n- documented\n",
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  const opened = answered(
    bdk(["attempt", "open", "part", "01", "--json"], root),
    "output/attempt-open.json",
  );
  return { root, dir, id, ticket: opened.ticket as string };
}

/** The Change of `started` with part 01 committed, conformed, checked, closed and done. */
function executed(): Started {
  const change = started();
  const run = (args: string[], schema: string) =>
    answered(bdk([...args, "--json"], change.root), schema);
  write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
  shell(change.root, checkRun(change, "01-1").commit?.command ?? "");
  write(change.root, "docs/01-2.md", "# Greeting\n");
  shell(change.root, checkRun(change, "01-2").commit?.command ?? "");
  run(["dispatch", "build", "01", "conformer", change.ticket], "output/dispatch-build.json");
  const report =
    "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n## Conformance\n\n- none apply\n";
  expect(bdk(ingestArgs(change.root, change.ticket, report), change.root).code).toBe(0);
  checkRun(change, "01");
  run(["attempt", "close", change.ticket, "ok"], "output/attempt-close.json");
  run(["part", "done", "01"], "output/part-done.json");
  return change;
}

function write(root: string, path: string, text: string): void {
  fileStore().write(join(root, path), text);
}

function checkRun(change: Started, target: string, ...flags: string[]): CheckRun {
  return answered(
    bdk(["check", "run", target, "--ticket", change.ticket, ...flags, "--json"], change.root),
    "output/check-run.json",
  ) as unknown as CheckRun;
}

function output(change: Started, file: string): string {
  return readFileSync(join(change.root, file), "utf8");
}

describe("bdk check run", () => {
  it("exit 0: runs each kind's commands on the task's files and prints its commit command", () => {
    const change = started();
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const report = checkRun(change, "01-1");
    const checks = `.bdk/.machine/checks/${change.ticket}`;
    expect(report).toMatchObject({
      verdict: "pass",
      checks: [
        {
          kind: "tests-scoped",
          tool: "unit",
          command: "echo tested src/01-1.ts",
          exit: 0,
          verdict: "pass",
          file: `${checks}/01-1-tests-scoped-unit.txt`,
        },
        { kind: "lint", tool: "eslint", command: "cat", exit: 0, verdict: "pass" },
      ],
      diff: { declared: ["src/01-1.ts"], touched: ["src/01-1.ts"], undeclared: [] },
    });
    expect(Object.keys(report.evidence)).toStrictEqual(["tests-scoped", "lint"]);
    expect(output(change, `${checks}/01-1-tests-scoped-unit.txt`)).toBe(
      "tested src/01-1.ts\nexit 0\n",
    );
    expect(report.commit).toStrictEqual({
      paths: ["src/01-1.ts"],
      command:
        `git add -- src/01-1.ts && git commit -m Greet --trailer 'BDK-Change: ${change.id}' ` +
        "--trailer 'BDK-Part: 01' --trailer 'BDK-Task: 01-1' -- src/01-1.ts",
    });

    shell(change.root, report.commit?.command ?? "");
    expect(git(change.root, "log", "-1", "--format=%(trailers:only)")).toContain("BDK-Task: 01-1");
    const parts = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(parts.items).toMatchObject([{ part: "01", done: 1, tasks: 2 }]);
  });

  it("exit 0: a command that reads stdin ends at once under a shell whose stdin never closes", async () => {
    const change = started();
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const result = await bdkOpenStdin(
      ["check", "run", "01-1", "--ticket", change.ticket, "--json"],
      change.root,
      20_000,
    );
    expect(result.code, result.stderr).toBe(0);
    expect(result.ms).toBeLessThan(10_000);
    expect((result.json as CheckRun).checks[1]).toMatchObject({ tool: "eslint", exit: 0 });
  });

  it("exit 0: a failing command fails its kind with the last 20 lines and prints no commit", () => {
    const change = started(settings("seq 1 30; exit 1", LINT));
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const report = checkRun(change, "01-1");
    expect(report.verdict).toBe("fail");
    const test = report.checks.find((check) => check.kind === "tests-scoped");
    expect(test).toMatchObject({ exit: 1, verdict: "fail" });
    expect(test?.tail).toStrictEqual(Array.from({ length: 20 }, (_, at) => String(at + 11)));
    expect(output(change, test?.file ?? "")).toMatch(/\n30\nexit 1\n$/);
    expect(report).not.toHaveProperty("commit");
  });

  it("exit 0: a tool not installed (exit 127) is not-run", () => {
    const change = started(settings(TEST, "bdk-no-such-linter {files}"));
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const report = checkRun(change, "01-1");
    expect(report.checks.find((check) => check.kind === "lint")).toMatchObject({
      exit: 127,
      verdict: "not-run",
    });
    expect(report.verdict).toBe("pass");
  });

  it("exit 0: a task with no executable file runs nothing and is not-run", () => {
    const change = started();
    write(change.root, "docs/01-2.md", "# Greeting\n");
    const report = checkRun(change, "01-2");
    expect(report.verdict).toBe("not-run");
    expect(report.checks).toStrictEqual([]);
    const file = `.bdk/.machine/checks/${change.ticket}/01-2-tests-scoped-none.txt`;
    expect(output(change, file)).toBe("not-run: 01-2 has no executable file\n");
    expect(report.commit?.paths).toStrictEqual(["docs/01-2.md"]);
  });

  it("exit 0: --skip leaves out an entry whose when does not apply; one without when is refused", () => {
    const change = started(
      settings(
        TEST,
        LINT,
        '    - { id: pytest, tier: fast, command: "exit 1", when: "only for Python files" }\n',
      ),
    );
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const report = checkRun(change, "01-1", "--skip", "pytest");
    const skipped = report.checks.find((check) => check.tool === "pytest");
    expect(skipped).toMatchObject({ skipped: "only for Python files", verdict: "not-run" });
    expect(skipped).not.toHaveProperty("exit");
    expect(output(change, skipped?.file ?? "")).toBe("skipped: only for Python files\n");
    expect(report.verdict).toBe("pass");

    const refusal = refused(
      bdk(
        ["check", "run", "01-1", "--ticket", change.ticket, "--skip", "unit", "--json"],
        change.root,
      ),
      3,
      "input/invalid-argument",
    );
    expect(refusal.why).toContain("--skip unit: the entry has no when");
  });

  it("exit 0: a part's run prints the conform commit with the ticket's trailer", () => {
    const change = started();
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    const report = checkRun(change, "01");
    expect(report.commit?.command).toBe(
      `git add -- src/01-1.ts && git commit -m 'refactor(01): conform part 01' --trailer 'BDK-Change: ${change.id}' ` +
        `--trailer 'BDK-Part: 01' --trailer 'BDK-Ticket: ${change.ticket}' -- src/01-1.ts`,
    );
  });

  it("exit 0: the part's evidence closes its ticket once each task is committed", () => {
    const change = started();
    answered(
      bdk(["dispatch", "build", "01", "implementer", change.ticket, "--json"], change.root),
      "output/dispatch-build.json",
    );
    write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
    shell(change.root, checkRun(change, "01-1").commit?.command ?? "");
    write(change.root, "docs/01-2.md", "# Greeting\n");
    shell(change.root, checkRun(change, "01-2").commit?.command ?? "");
    answered(
      bdk(["dispatch", "build", "01", "conformer", change.ticket, "--json"], change.root),
      "output/dispatch-build.json",
    );
    const report =
      "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n## Conformance\n\n- none apply\n";
    expect(bdk(ingestArgs(change.root, change.ticket, report), change.root).code).toBe(0);
    expect(checkRun(change, "01")).not.toHaveProperty("commit");
    const closed = answered(
      bdk(["attempt", "close", change.ticket, "ok", "--json"], change.root),
      "output/attempt-close.json",
    );
    expect(closed.outcome).toBe("ok");
  });

  it("exit 0: a review round checks its fix over the Change and prints no commit", () => {
    const change = executed();
    const round = answered(
      bdk(["attempt", "open", "review-fix", change.id, "--json"], change.root),
      "output/attempt-open.json",
    ).ticket as string;
    write(change.root, "src/01-1.ts", "export const greet = () => 'hello';\n");
    const fix = { ...change, ticket: round };
    const report = checkRun(fix, change.id);
    expect(report).toMatchObject({
      verdict: "pass",
      checks: [
        { kind: "tests-scoped", command: "echo tested src/01-1.ts", verdict: "pass" },
        { kind: "lint", verdict: "pass" },
      ],
    });
    expect(report).not.toHaveProperty("commit");
    expect(
      refused(
        bdk(["check", "run", "01", "--ticket", round, "--json"], change.root),
        3,
        "input/invalid-argument",
      ).instead,
    ).toStrictEqual([`bdk check run ${change.id} --ticket ${round}`]);
  });

  it(
    "exit 0: a command past execution.checks.timeout is killed and fails",
    { timeout: 40_000 },
    () => {
      const change = started(
        settings("sleep 60", LINT).replace(
          "tools:",
          "execution:\n  checks:\n    timeout: 10\ntools:",
        ),
      );
      write(change.root, "src/01-1.ts", "export const greet = () => 'hi';\n");
      const startedAt = Date.now();
      const report = checkRun(change, "01-1");
      expect(Date.now() - startedAt).toBeLessThan(20_000);
      const test = report.checks.find((check) => check.kind === "tests-scoped");
      expect(test).toMatchObject({ timeout: 10, verdict: "fail" });
      expect(output(change, test?.file ?? "")).toMatch(/timeout 10\n$/);
    },
  );

  it("exit 2: policy/no-open-ticket for a closed ticket, and no command runs", () => {
    const change = started();
    answered(
      bdk(["attempt", "close", change.ticket, "not-run", "--reason", "r", "--json"], change.root),
      "output/attempt-close.json",
    );
    refused(
      bdk(["check", "run", "01-1", "--ticket", change.ticket, "--json"], change.root),
      2,
      "policy/no-open-ticket",
    );
    expect(existsSync(join(change.root, ".bdk/.machine/checks", change.ticket))).toBe(false);
  });

  it("exit 2: policy/do-not-touch before any command runs", () => {
    const change = started();
    write(change.root, "src/billing/invoice.ts", "export {};\n");
    refused(
      bdk(["check", "run", "01-1", "--ticket", change.ticket, "--json"], change.root),
      2,
      "policy/do-not-touch",
    );
    expect(existsSync(join(change.root, ".bdk/.machine/checks", change.ticket))).toBe(false);
  });

  it("exit 3: an unknown target is input/not-found; a malformed one input/invalid-argument", () => {
    const change = started();
    refused(
      bdk(["check", "run", "01-9", "--ticket", change.ticket, "--json"], change.root),
      3,
      "input/not-found",
    );
    refused(
      bdk(["check", "run", "login", "--ticket", change.ticket, "--json"], change.root),
      3,
      "input/invalid-argument",
    );
  });

  it("exit 5: runtime/git-missing", () => {
    const change = started();
    refused(
      bdk(["check", "run", "01-1", "--ticket", change.ticket, "--json"], change.root, {
        git: false,
      }),
      5,
      "runtime/git-missing",
    );
  });
});
