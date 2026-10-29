import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkGroup } from "../src/check/index.ts";
import { checkPlan } from "../src/check/schema/plan.ts";
import type { CheckPlan } from "../src/check/schema/plan.ts";
import { recordResult } from "../src/check/schema/record.ts";
import { run } from "../src/shared/cli/index.ts";
import { files } from "../src/shared/fs/index.ts";
import { git } from "../src/shared/git/index.ts";

// `bdk check` end to end (ADR-0011): the frame, the slice, the config and findings slices, and the
// file system boundary against a temporary project, the way `src/main.ts` wires them. Each
// printed line runs through `/bin/sh` from the project root, as the agent's Bash call runs it.

const RUN = ".bdk/runs/v3-1-x";
let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "bdk-check-"));
  mkdirSync(join(project, "openspec"));
  mkdirSync(join(project, RUN), { recursive: true });
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

function settings(yaml: string): void {
  mkdirSync(join(project, ".bdk"), { recursive: true });
  writeFileSync(join(project, ".bdk", "settings.yaml"), yaml);
}

function read(path: string): string {
  return readFileSync(join(project, path), "utf8");
}

async function bdk(
  args: readonly string[],
  cwd = project,
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const code = await run({
    argv: args,
    version: "0.0.0",
    nodeVersion: process.versions.node,
    groups: [
      checkGroup({ files, cwd, home: project, env, git: (at, gitArgs) => git(at, gitArgs) }),
    ],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

/** Plans `<id>` with `--json`, runs each line from the project root, and returns the `--exit` flags. */
async function planAndRun(id: string, extra: readonly string[] = []): Promise<string[]> {
  const planned = await bdk(["check", "plan", RUN, id, ...extra, "--json"]);
  expect(planned).toMatchObject({ code: 0, stderr: "" });
  const plan: CheckPlan = checkPlan.parse(JSON.parse(planned.stdout));
  expect(planned.stdout).toBe(read(`${RUN}/checks/${id}/plan.json`));
  return plan.checks.flatMap((check) => {
    const { status } = spawnSync("/bin/sh", ["-c", check.line], { cwd: project });
    return ["--exit", `${check.kind}-${check.tool}=${String(status)}`];
  });
}

const LIST_ARGS = `tools:
  test:
    - id: args
      command: "printf '[%s]' {files}"
  lint:
    - id: stdin
      command: "cat; echo read-eof"
`;

describe("bdk check plan and record", () => {
  it("plans quoted lines, runs them through the shell and records the result", async () => {
    settings(LIST_ARGS);
    const exits = await planAndRun("01", ["--scope", "src/b c.ts", "--scope", "src/it's.ts"]);
    expect(exits).toEqual(["--exit", "test-args=0", "--exit", "lint-stdin=0"]);
    const { code, stdout, stderr } = await bdk(["check", "record", RUN, "01", ...exits, "--json"]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toBe(read(`${RUN}/checks/01.json`));
    expect(recordResult.parse(JSON.parse(stdout))).toMatchObject({
      version: 3,
      verdict: "pass",
      scope: ["src/b c.ts", "src/it's.ts"],
      checks: [
        {
          kind: "test",
          tool: "args",
          command: "printf '[%s]' 'src/b c.ts' 'src/it'\\''s.ts'",
          cwd: project,
          scoped: true,
          status: "pass",
          exit: 0,
          output: `${RUN}/checks/01/test-args.txt`,
        },
        { kind: "lint", tool: "stdin", scoped: false, status: "pass" },
      ],
    });
    expect(read(`${RUN}/checks/01/test-args.txt`)).toBe("[src/b c.ts][src/it's.ts]\nexit 0\n");
    expect(read(`${RUN}/checks/01/lint-stdin.txt`)).toBe("read-eof\nexit 0\n");
  });

  it("routes picked tests to test items and changed files to lint, in a real repository", async () => {
    settings(`tools:
  test:
    - id: unit
      command: "printf 'unit[%s]' {files}"
      paths: ["src/**"]
      when: [part]
    - id: e2e
      command: "printf 'e2e[%s]' {files}"
      paths: ["e2e/**"]
      when: [part]
    - id: suite
      command: echo suite
      when: [wave, review]
  lint:
    - id: changed
      command: "printf 'lint[%s]' {files}"
`);
    const sh = (...args: string[]) =>
      execFileSync("git", args, { cwd: project, stdio: ["ignore", "pipe", "pipe"] });
    writeFileSync(join(project, ".gitignore"), "dist/\n.bdk/\n");
    mkdirSync(join(project, "src"));
    writeFileSync(join(project, "src", "a.ts"), "a\n");
    writeFileSync(join(project, "src", "old.ts"), "old\n");
    sh("init", "-q");
    sh("add", ".");
    sh("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");
    writeFileSync(join(project, "src", "a.ts"), "a2\n");
    unlinkSync(join(project, "src", "old.ts"));
    writeFileSync(join(project, "src", "c.ts"), "c\n");
    sh("add", "src/c.ts");
    mkdirSync(join(project, "dist"));
    writeFileSync(join(project, "dist", "a.js"), "x\n");

    const part = ["--at", "part", "--changed", "HEAD", "--tests", "src/a.test.ts"];
    const exits = await planAndRun("01", part);
    expect(exits).toEqual(["--exit", "test-unit=0", "--exit", "lint-changed=0"]);
    const recorded = await bdk(["check", "record", RUN, "01", ...exits]);
    expect(recorded).toMatchObject({ code: 0, stderr: "" });
    expect(recorded.stdout.split("\n")[0]).toBe("at part, changed against HEAD");
    expect(read(`${RUN}/checks/01/test-unit.txt`)).toBe("unit[src/a.test.ts]\nexit 0\n");
    expect(read(`${RUN}/checks/01/lint-changed.txt`)).toBe(
      "lint[src/a.ts]lint[src/c.ts]\nexit 0\n",
    );
    expect(recordResult.parse(JSON.parse(read(`${RUN}/checks/01.json`)))).toMatchObject({
      tests: ["src/a.test.ts"],
      skipped: [{ kind: "test", tool: "e2e", reason: "paths" }],
    });

    const wave = await planAndRun("wave-1", ["--at", "wave", "--changed", "HEAD"]);
    expect(wave).toEqual(["--exit", "test-suite=0", "--exit", "lint-changed=0"]);

    const unknown = await bdk([
      "check",
      "plan",
      RUN,
      "02",
      "--changed",
      "no-such-branch",
      "--json",
    ]);
    expect(unknown.code).toBe(2);
    expect(JSON.parse(unknown.stdout)).toMatchObject({
      error: {
        code: "usage/invalid-argument",
        message: expect.stringContaining("no-such-branch") as unknown,
      },
    });
  });

  it("prints the lines to run with the capped Bash timeout and its note", async () => {
    settings(`tools:
  test:
    - id: e2e
      command: npm run test:e2e -- {files}
      paths: ["e2e/**/*.spec.ts"]
      timeout: 900
`);
    const args = ["check", "plan", RUN, "02-red", "--tests", "e2e/a.spec.ts"];
    const capped = await bdk(args);
    expect(capped).toMatchObject({ code: 0, stderr: "" });
    expect(capped.stdout).toBe(
      [
        "check 02-red: 1 to run, 0 skipped; run each line below as its own Bash call from the project root, one after another, with its timeout",
        `1. test e2e  scoped  in ${project}  timeout 600000`,
        `    npm run test:e2e -- e2e/a.spec.ts </dev/null > ${RUN}/checks/02-red/test-e2e.txt 2>&1`,
        '    note: its timeout of 900 s exceeds the Bash cap of 600 s; set env.BASH_MAX_TIMEOUT_MS to "900000" in .claude/settings.json',
        `then: bdk check record ${RUN} 02-red --exit test-e2e=<code> (--timed-out <kind>-<tool> for a call the Bash tool ended at its timeout)`,
        `plan: ${RUN}/checks/02-red/plan.json`,
        "",
      ].join("\n"),
    );
    const raised = await bdk(args, project, { BASH_MAX_TIMEOUT_MS: "1800000" });
    expect(raised.stdout).toContain("timeout 900000\n");
    expect(raised.stdout).not.toContain("note:");
  });

  it("reports a red check with its tail, a timed-out one and a not-run one, and appends them to the round", async () => {
    settings(`tools:
  test:
    - id: slow
      command: "echo started"
      timeout: 1
  lint:
    - id: eslint
      command: "sh -c 'echo src/a.ts: 1 problem >&2; exit 2'"
  build:
    - id: tsc
      command: "echo built"
`);
    const exits = await planAndRun("round-1");
    expect(exits).toEqual([
      "--exit",
      "test-slow=0",
      "--exit",
      "lint-eslint=2",
      "--exit",
      "build-tsc=0",
    ]);
    const { code, stdout, stderr } = await bdk([
      "check",
      "record",
      RUN,
      "round-1",
      "--round",
      "1",
      "--timed-out",
      "test-slow",
      "--exit",
      "lint-eslint=2",
    ]);
    expect({ code, stderr }).toEqual({ code: 1, stderr: "" });
    expect(stdout).toBe(
      [
        `timeout  test slow    full    ${RUN}/checks/round-1/test-slow.txt`,
        "    | started",
        `fail     lint eslint  full    ${RUN}/checks/round-1/lint-eslint.txt`,
        "    | src/a.ts: 1 problem",
        `not-run  build tsc    full    ${RUN}/checks/round-1/build-tsc.txt`,
        "    no exit code was given for it; run its line, then record again",
        "verdict: fail (3 of 3 red)",
        `result: ${RUN}/checks/round-1.json`,
        `findings: 3 appended to ${RUN}/review/round-1/findings.jsonl`,
        "",
      ].join("\n"),
    );
    expect(read(`${RUN}/checks/round-1/test-slow.txt`)).toBe("started\ntimeout 1\n");
    expect(read(`${RUN}/checks/round-1/lint-eslint.txt`)).toBe("src/a.ts: 1 problem\nexit 2\n");
    expect(read(`${RUN}/checks/round-1/build-tsc.txt`)).toBe("built\n");
    const summaries = read(`${RUN}/review/round-1/findings.jsonl`)
      .trimEnd()
      .split("\n")
      .map((line) => (JSON.parse(line) as { summary: string }).summary);
    expect(summaries).toEqual([
      "test slow timed out after 1 s",
      "lint eslint failed with exit 2",
      "build tsc was not run",
    ]);
  });

  it("gives byte-identical results for the same codes and outputs", async () => {
    settings(LIST_ARGS);
    const exits = await planAndRun("03", ["--scope", "a.ts"]);
    const first = await bdk(["check", "record", RUN, "03", ...exits, "--json"]);
    const second = await bdk(["check", "record", RUN, "03", ...exits, "--json"]);
    expect(second.stdout).toBe(first.stdout);
  });

  it("refuses --changed outside a git work tree, an unknown point and a record without a plan", async () => {
    settings(LIST_ARGS);
    const outside = await bdk(["check", "plan", RUN, "01", "--changed", "HEAD", "--json"]);
    expect(outside.code).toBe(3);
    expect(JSON.parse(outside.stdout)).toMatchObject({ error: { code: "env/not-a-repo" } });
    const point = await bdk(["check", "plan", RUN, "01", "--at", "merge", "--json"]);
    expect(point.code).toBe(2);
    expect(JSON.parse(point.stdout)).toMatchObject({
      error: {
        code: "usage/invalid-argument",
        message: expect.stringContaining("part, wave") as unknown,
      },
    });
    const missing = await bdk(["check", "record", RUN, "07", "--exit", "test-args=0", "--json"]);
    expect(missing.code).toBe(3);
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: { code: "env/plan-missing" } });
  });

  it("shows the repeatable flags in the help of both verbs", async () => {
    const plan = await bdk(["check", "plan", "--help"]);
    expect(plan.code).toBe(0);
    expect(plan.stdout).toContain("Usage: bdk check plan <run-dir> <id> [flags]");
    for (const flag of ["scope", "tests", "kind"]) {
      expect(plan.stdout).toMatch(new RegExp(`^ {2}--${flag} <value> +.* \\(repeatable\\)$`, "m"));
    }
    const record = await bdk(["check", "record", "--help"]);
    expect(record.code).toBe(0);
    for (const flag of ["exit", "timed-out"]) {
      expect(record.stdout).toMatch(
        new RegExp(`^ {2}--${flag} <value> +.* \\(repeatable\\)$`, "m"),
      );
    }
  });

  it("knows bdk check run no more", async () => {
    settings(LIST_ARGS);
    const { code, stdout } = await bdk(["check", "run", RUN, "01", "--json"]);
    expect(code).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "usage/unknown-command" } });
  });

  it("refuses to plan in a project that is not configured", async () => {
    const { code, stdout } = await bdk(["check", "plan", RUN, "01", "--json"]);
    expect(code).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "env/not-configured" } });
  });
});
