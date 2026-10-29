import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import { renderPlan } from "../render/plan.ts";
import { renderRecord } from "../render/record.ts";
import { checkPlan } from "../schema/plan.ts";
import { recordResult } from "../schema/record.ts";
import { planCheckRun } from "../use-cases/plan.ts";
import type { PlanInput } from "../use-cases/plan.ts";
import { recordChecks } from "../use-cases/record.ts";
import type { RecordInput } from "../use-cases/record.ts";
import { fakeGit, memory, ROOT, RUN } from "./memory.ts";

// `bdk check plan` and `bdk check record` against an in-memory file system (ADR-0011).

const SETTINGS = `tools:
  test:
    - id: unit
      command: vitest run {files}
  lint:
    - id: eslint
      command: eslint .
      timeout: 30
`;

const SPLIT = `tools:
  test:
    - id: vitest-related
      command: pnpm vitest related --run {files}
      paths: ["src/**"]
    - id: playwright-changed
      command: npm run test:e2e -- {files}
      paths: ["e2e/**/*.spec.ts"]
      timeout: 900
  lint:
    - id: eslint-changed
      command: pnpm eslint {files}
      paths: ["**/*.ts"]
`;

const DIFF = "diff --name-only --relative --no-renames --no-ext-diff --diff-filter=d -z HEAD --";

/** The answers of a clean repository at `ROOT`, `HEAD` resolving. */
const REPO: Record<string, string> = {
  "rev-parse --is-inside-work-tree": "true\n",
  "rev-parse --verify --quiet HEAD^{commit}": "abc\n",
  [DIFF]: "",
  "ls-files --others --exclude-standard -z": "",
};

function project(
  settings = SETTINGS,
  answers: Record<string, string> = REPO,
  env: Record<string, string> = {},
) {
  const files = memory({
    [`${ROOT}/.bdk/settings.yaml`]: settings,
    [`${ROOT}/openspec/config.yaml`]: "schema: spec-driven\n",
    [`${ROOT}/${RUN}/state.json`]: "{}",
  });
  const git = fakeGit(answers);
  const deps = { files, git, cwd: ROOT, home: "/home/me", env };
  return { files, git, deps };
}

type Deps = ReturnType<typeof project>["deps"];

const input = (extra: Partial<PlanInput> = {}): PlanInput => ({ runDir: RUN, id: "02", ...extra });
const plan = (deps: Deps, extra: Partial<PlanInput> = {}) => planCheckRun(deps, input(extra)).plan;

/** Writes a check's output as its line would. */
function ran(deps: Deps, id: string, key: string, output: string): void {
  deps.files.writeText(`${ROOT}/${RUN}/checks/${id}/${key}.txt`, output);
}

const record = (deps: Deps, extra: Partial<RecordInput> = {}) =>
  recordChecks(deps, { runDir: RUN, id: "02", ...extra });

function failure(action: () => unknown): CliError {
  try {
    action();
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error("expected a CliError");
}

describe("planCheckRun", () => {
  it("prints the real command as the line to run and writes the plan, running nothing", () => {
    const { files, git, deps } = project(SPLIT, REPO, { BASH_MAX_TIMEOUT_MS: "1800000" });
    const { plan: result, file } = planCheckRun(
      deps,
      input({ id: "02-red", at: "part", kinds: ["test"], tests: ["e2e/a.spec.ts"] }),
    );
    expect(git.calls).toEqual([]);
    expect(result).toEqual({
      version: 1,
      id: "02-red",
      at: "part",
      changed: null,
      scope: null,
      tests: ["e2e/a.spec.ts"],
      cwd: ROOT,
      checks: [
        {
          kind: "test",
          tool: "playwright-changed",
          command: "npm run test:e2e -- e2e/a.spec.ts",
          scoped: true,
          timeout: 900,
          "bash-timeout": 900_000,
          output: `${RUN}/checks/02-red/test-playwright-changed.txt`,
          line: `npm run test:e2e -- e2e/a.spec.ts </dev/null > ${RUN}/checks/02-red/test-playwright-changed.txt 2>&1`,
          notes: [],
        },
      ],
      skipped: [{ kind: "test", tool: "vitest-related", reason: "paths" }],
    });
    expect(checkPlan.parse(result)).toEqual(result);
    expect(file).toBe(`${RUN}/checks/02-red/plan.json`);
    expect(files.data.get(`${ROOT}/${file}`)).toBe(`${JSON.stringify(result)}\n`);
    expect([...files.data.keys()].filter((path) => path.endsWith(".txt"))).toEqual([]);
  });

  it("caps the Bash timeout at 600 s without BASH_MAX_TIMEOUT_MS and notes the key to set", () => {
    const { deps } = project(SPLIT);
    const [check] = plan(deps, { kinds: ["test"], tests: ["e2e/a.spec.ts"] }).checks;
    expect(check?.["bash-timeout"]).toBe(600_000);
    expect(check?.notes).toEqual([
      'its timeout of 900 s exceeds the Bash cap of 600 s; set env.BASH_MAX_TIMEOUT_MS to "900000" in .claude/settings.json',
    ]);
  });

  it("gives test items the picked tests and lint items the changed files", () => {
    const { deps } = project(SPLIT, { ...REPO, [DIFF]: "src/checkout.ts\0" });
    const result = plan(deps, {
      id: "03",
      at: "part",
      changed: "HEAD",
      tests: ["src/checkout.test.ts", "e2e/checkout.spec.ts"],
    });
    expect(result.checks.map((check) => check.command)).toEqual([
      "pnpm vitest related --run src/checkout.test.ts",
      "npm run test:e2e -- e2e/checkout.spec.ts",
      "pnpm eslint src/checkout.ts",
    ]);
    expect(result).toMatchObject({
      scope: ["src/checkout.ts"],
      tests: ["e2e/checkout.spec.ts", "src/checkout.test.ts"],
      skipped: [],
    });
  });

  it("skips the E2E item when no E2E spec is picked", () => {
    const { deps } = project(SPLIT, { ...REPO, [DIFF]: "src/checkout.ts\0" });
    const result = plan(deps, { changed: "HEAD", tests: ["src/checkout.test.ts"] });
    expect(result.checks.map((check) => check.tool)).toEqual(["vitest-related", "eslint-changed"]);
    expect(result.skipped).toEqual([{ kind: "test", tool: "playwright-changed", reason: "paths" }]);
  });

  it("gives test items the changed files without --tests", () => {
    const { deps } = project(
      `tools:\n  test:\n    - id: api\n      command: uv run pytest\n      paths: ["api/**"]\n`,
      {
        ...REPO,
        "rev-parse --verify --quiet main^{commit}": "abc\n",
        [DIFF.replace("HEAD", "main")]: "api/app.py\0",
      },
    );
    const [check] = plan(deps, { id: "wave-1", at: "wave", changed: "main" }).checks;
    expect(check?.line).toBe(`uv run pytest </dev/null > ${RUN}/checks/wave-1/test-api.txt 2>&1`);
  });

  it("plans only the entries of the point asked for, and those without when", () => {
    const { deps } = project(`tools:
  test:
    - id: related
      command: vitest related --run {files}
      when: [part]
    - id: unit
      command: vitest run
      when: [wave, review]
    - id: smoke
      command: node smoke.js
`);
    const wave = plan(deps, { id: "wave-1", at: "wave", scope: ["src/a.ts"] });
    expect(wave.checks.map((check) => check.command)).toEqual(["vitest run", "node smoke.js"]);
    expect(wave).toMatchObject({ at: "wave", skipped: [] });
    const part = plan(deps, { at: "part", scope: ["src/a.ts"] });
    expect(part.checks.map((check) => check.command)).toEqual([
      "vitest related --run src/a.ts",
      "node smoke.js",
    ]);
  });

  it("adds the files git reports changed against a revision to the run's files", () => {
    const { git, deps } = project(SETTINGS, {
      ...REPO,
      [DIFF]: "src/a.ts\0src/c.ts\0",
      "ls-files --others --exclude-standard -z": "test/a.test.ts\0",
    });
    const result = plan(deps, { changed: "HEAD", scope: ["src/a.ts", "docs/x.md"] });
    expect(result.checks[0]?.command).toBe("vitest run docs/x.md src/a.ts src/c.ts test/a.test.ts");
    expect(result).toMatchObject({
      changed: "HEAD",
      scope: ["docs/x.md", "src/a.ts", "src/c.ts", "test/a.test.ts"],
    });
    expect(new Set(git.calls.map((call) => call.cwd))).toEqual(new Set([ROOT]));
  });

  it("skips a {files} entry with reason no-files when nothing changed", () => {
    const { deps } = project();
    const result = plan(deps, { at: "part", changed: "HEAD" });
    expect(result.checks.map((check) => check.command)).toEqual(["eslint ."]);
    expect(result.skipped).toEqual([{ kind: "test", tool: "unit", reason: "no-files" }]);
  });

  it("plans only the kinds asked for", () => {
    const { deps } = project();
    expect(plan(deps, { kinds: ["lint"] }).checks.map((check) => check.kind)).toEqual(["lint"]);
  });

  it("notes a compound command", () => {
    const { deps } = project(
      `tools:\n  build:\n    - id: build\n      command: pnpm codegen && pnpm build\n`,
    );
    const [check] = plan(deps).checks;
    expect(check?.line).toBe(
      `pnpm codegen && pnpm build </dev/null > ${RUN}/checks/02/build-build.txt 2>&1`,
    );
    expect(check?.notes).toEqual([
      "it holds a shell list or pipe, so only its last part writes to the output file; a project script keeps the command whole",
    ]);
  });

  it("writes an empty plan when nothing is configured", () => {
    const { files, deps } = project("languages: [typescript]\n");
    const { plan: result, file } = planCheckRun(deps, input());
    expect(result).toMatchObject({ checks: [], skipped: [] });
    expect(files.data.has(`${ROOT}/${RUN}/checks/02/plan.json`)).toBe(true);
    expect(renderPlan(result, RUN, file)).toBe(
      [
        "check 02: nothing to run, 0 skipped",
        "no check configured for this run",
        `then: bdk check record ${RUN} 02`,
        `plan: ${RUN}/checks/02/plan.json`,
        "",
      ].join("\n"),
    );
  });

  it("writes the line from the project root for a run directory given from elsewhere", () => {
    const { deps } = project();
    const result = plan({ ...deps, cwd: `${ROOT}/src` }, { runDir: `../${RUN}`, kinds: ["lint"] });
    expect(result.checks[0]).toMatchObject({
      output: `../${RUN}/checks/02/lint-eslint.txt`,
      line: `eslint . </dev/null > ${RUN}/checks/02/lint-eslint.txt 2>&1`,
    });
    const outside = project();
    outside.files.writeText("/elsewhere/run/state.json", "{}");
    const [check] = plan(outside.deps, { runDir: "/elsewhere/run", kinds: ["lint"] }).checks;
    expect(check?.line).toBe("eslint . </dev/null > /elsewhere/run/checks/02/lint-eslint.txt 2>&1");
  });

  it("prints each line under its header, the skips and the record call", () => {
    const { deps } = project(`tools:
  test:
    - id: api
      command: uv run pytest {files}
      paths: ["api/**"]
    - id: web
      command: pnpm vitest run {files}
      paths: ["web/**"]
`);
    const { plan: result, file } = planCheckRun(deps, input({ tests: ["web/src/a.test.tsx"] }));
    expect(renderPlan(result, RUN, file)).toBe(
      [
        "check 02: 1 to run, 1 skipped; run each line below as its own Bash call from the project root, one after another, with its timeout",
        `1. test web  scoped  in ${ROOT}  timeout 600000`,
        `    pnpm vitest run web/src/a.test.tsx </dev/null > ${RUN}/checks/02/test-web.txt 2>&1`,
        "skip  test api  no file it takes matches its paths",
        `then: bdk check record ${RUN} 02 --exit test-web=<code> (--timed-out <kind>-<tool> for a call the Bash tool ended at its timeout)`,
        `plan: ${RUN}/checks/02/plan.json`,
        "",
      ].join("\n"),
    );
  });
});

describe("recordChecks", () => {
  function planned(settings = SETTINGS) {
    const setup = project(settings);
    planCheckRun(setup.deps, input({ scope: ["src/a.ts"] }));
    return setup;
  }

  it("records the exit codes, appends the exit lines and writes a version 3 result", () => {
    const { files, deps } = planned();
    ran(deps, "02", "test-unit", "ok\n");
    ran(deps, "02", "lint-eslint", "");
    const { result, file } = record(deps, { exits: ["test-unit=0", "lint-eslint=0"] });
    expect(result).toEqual({
      version: 3,
      id: "02",
      at: null,
      changed: null,
      scope: ["src/a.ts"],
      tests: null,
      verdict: "pass",
      checks: [
        {
          kind: "test",
          tool: "unit",
          command: "vitest run src/a.ts",
          cwd: ROOT,
          scoped: true,
          status: "pass",
          exit: 0,
          timeout: 600,
          output: `${RUN}/checks/02/test-unit.txt`,
          tail: null,
        },
        {
          kind: "lint",
          tool: "eslint",
          command: "eslint .",
          cwd: ROOT,
          scoped: false,
          status: "pass",
          exit: 0,
          timeout: 30,
          output: `${RUN}/checks/02/lint-eslint.txt`,
          tail: null,
        },
      ],
      skipped: [],
      findings: null,
    });
    expect(recordResult.parse(result)).toEqual(result);
    expect(file).toBe(`${RUN}/checks/02.json`);
    expect(files.data.get(`${ROOT}/${file}`)).toBe(`${JSON.stringify(result)}\n`);
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/test-unit.txt`)).toBe("ok\nexit 0\n");
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/lint-eslint.txt`)).toBe("exit 0\n");
  });

  it("keeps the tail of a red check and fails the verdict", () => {
    const { deps } = planned();
    ran(deps, "02", "test-unit", "ok\n");
    ran(deps, "02", "lint-eslint", "a.ts:1 no-var\n1 problem");
    const { result, file } = record(deps, { exits: ["test-unit=0", "lint-eslint=2"] });
    expect(result.verdict).toBe("fail");
    expect(result.checks[1]).toMatchObject({
      status: "fail",
      exit: 2,
      tail: ["a.ts:1 no-var", "1 problem"],
    });
    expect(renderRecord(result, file)).toBe(
      [
        `pass  test unit    scoped  ${RUN}/checks/02/test-unit.txt`,
        `fail  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
        "    | a.ts:1 no-var",
        "    | 1 problem",
        "verdict: fail (1 of 2 red)",
        `result: ${RUN}/checks/02.json`,
        "",
      ].join("\n"),
    );
  });

  it("says under a cut tail that the output file holds the rest", () => {
    const { deps } = planned();
    const long = Array.from({ length: 57 }, (_, n) => `line ${String(n + 1)}`).join("\n");
    ran(deps, "02", "test-unit", long);
    ran(deps, "02", "lint-eslint", "");
    const { result, file } = record(deps, { exits: ["test-unit=1", "lint-eslint=0"] });
    const text = renderRecord(result, file).split("\n");
    const tail = Array.from({ length: 20 }, (_, n) => `    | line ${String(n + 38)}`);
    expect(text.slice(1, 23)).toEqual([
      ...tail,
      "    (last 20 lines; the whole output is in the file above)",
      `pass  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
    ]);
  });

  it("records a timed-out call with its timeout line", () => {
    const { files, deps } = planned();
    ran(deps, "02", "lint-eslint", "slow\n");
    const { result } = record(deps, { exits: ["test-unit=0"], timedOut: ["lint-eslint"] });
    expect(result.checks[1]).toMatchObject({ status: "timeout", exit: null, tail: ["slow"] });
    expect(result.verdict).toBe("fail");
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/lint-eslint.txt`)).toBe("slow\ntimeout 30\n");
  });

  it("marks a check nobody gave a code for as not-run and writes nothing into its file", () => {
    const { files, deps } = planned();
    ran(deps, "02", "test-unit", "ok\n");
    const { result, file } = record(deps, { exits: ["test-unit=0"] });
    expect(result.checks[1]).toMatchObject({ status: "not-run", exit: null, tail: null });
    expect(result.verdict).toBe("fail");
    expect(files.data.has(`${ROOT}/${RUN}/checks/02/lint-eslint.txt`)).toBe(false);
    expect(renderRecord(result, file).split("\n").slice(1, 3)).toEqual([
      `not-run  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
      "    no exit code was given for it; run its line, then record again",
    ]);
  });

  it("appends the exit line once when recorded twice, and replaces the result", () => {
    const { files, deps } = planned();
    ran(deps, "02", "test-unit", "FAIL\n");
    record(deps, { exits: ["test-unit=1"] });
    const { result } = record(deps, { exits: ["test-unit=1", "lint-eslint=0"] });
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/test-unit.txt`)).toBe("FAIL\nexit 1\n");
    expect(result.checks[0]?.tail).toEqual(["FAIL"]);
    const saved = JSON.parse(files.data.get(`${ROOT}/${RUN}/checks/02.json`) ?? "") as unknown;
    expect(saved).toMatchObject({ checks: [{ status: "fail" }, { status: "pass" }] });
  });

  it("writes verdict none for an empty plan", () => {
    const { deps } = planned("languages: []\n");
    const { result, file } = record(deps);
    expect(result).toMatchObject({ verdict: "none", checks: [] });
    expect(renderRecord(result, file)).toBe(
      [
        "no check configured for this run",
        "verdict: none",
        `result: ${RUN}/checks/02.json`,
        "",
      ].join("\n"),
    );
  });

  it("carries the plan's skipped entries and selection", () => {
    const { deps } = project(SETTINGS);
    planCheckRun(deps, input({ at: "part", changed: "HEAD" }));
    const { result, file } = record(deps, { exits: ["lint-eslint=0"] });
    expect(result).toMatchObject({
      at: "part",
      changed: "HEAD",
      skipped: [{ kind: "test", tool: "unit", reason: "no-files" }],
    });
    expect(renderRecord(result, file).split("\n").slice(0, 3)).toEqual([
      "at part, changed against HEAD",
      `pass  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
      "skip  test unit    no files for its {files}",
    ]);
  });
});

describe("red checks as findings", () => {
  const LOG = `${ROOT}/${RUN}/review/round-2/findings.jsonl`;

  function round() {
    const setup = project();
    planCheckRun(setup.deps, input({ id: "round-2" }));
    return setup;
  }

  it("appends one finding per red check with a stable id", () => {
    const { files, deps } = round();
    const extra = { id: "round-2", round: "2", exits: ["lint-eslint=1"] };
    const first = record(deps, extra).result;
    const second = record(deps, extra).result;
    expect(first.findings).toEqual({
      log: `${RUN}/review/round-2/findings.jsonl`,
      ids: [expect.stringMatching(/^f-[0-9a-f]{12}$/) as unknown],
    });
    expect(second.findings).toEqual(first.findings);
    const lines = (files.data.get(LOG) ?? "").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      type: "finding",
      id: first.findings?.ids[0],
      source: "check-run",
      summary: "lint eslint failed with exit 1",
      rule: "check/lint/eslint",
      evidence: `${RUN}/checks/round-2/lint-eslint.txt`,
    });
  });

  it("appends nothing when every check passes", () => {
    const { files, deps } = round();
    const { result } = record(deps, { id: "round-2", round: "2", exits: ["lint-eslint=0"] });
    expect(result.findings).toEqual({ log: `${RUN}/review/round-2/findings.jsonl`, ids: [] });
    expect(files.data.has(LOG)).toBe(false);
  });
});

describe("errors before any file is written", () => {
  it.each([
    [{ id: "Part-2" }, "<id>"],
    [{ kinds: ["tests"] }, "test, lint or build"],
    [{ scope: ["a.ts", ""] }, "--scope"],
    [{ tests: [""] }, "--tests"],
    [{ at: "merge" }, "part, wave or review"],
    [{ changed: "no-such-branch" }, "no-such-branch"],
    [{ changed: "--output=x" }, "--output=x"],
  ])("plan refuses %j as usage/invalid-argument", (extra, named) => {
    const { files, deps } = project();
    const before = new Map(files.data);
    const error = failure(() => planCheckRun(deps, input(extra)));
    expect(error.code).toBe("usage/invalid-argument");
    expect(error.message).toContain(named);
    expect(files.data).toEqual(before);
  });

  it.each([
    [{ id: "Part-2" }, "<id>"],
    [{ round: "0" }, "--round"],
    [{ round: "2a" }, "--round"],
    [{ exits: ["test-unit"] }, "test-unit"],
    [{ exits: ["test-unit=256"] }, "0 to 255"],
    [{ exits: ["test-unit=-1"] }, "test-unit=-1"],
    [{ exits: ["test-jest=0"] }, "planned: test-unit, lint-eslint"],
    [{ exits: ["test-unit=0", "test-unit=1"] }, "twice"],
    [{ exits: ["test-unit=0"], timedOut: ["test-unit"] }, "twice"],
    [{ timedOut: ["lint-ruff"] }, "lint-ruff"],
  ])("record refuses %j as usage/invalid-argument", (extra, named) => {
    const { files, deps } = project();
    planCheckRun(deps, input({ scope: ["src/a.ts"] }));
    const before = new Map(files.data);
    const error = failure(() => record(deps, extra));
    expect(error.code).toBe("usage/invalid-argument");
    expect(error.message).toContain(named);
    expect(files.data).toEqual(before);
  });

  it("record refuses a missing or unreadable plan, pointing at bdk check plan", () => {
    const { files, deps } = project();
    const error = failure(() => record(deps, { id: "07", exits: ["test-unit=0"] }));
    expect(error.code).toBe("env/plan-missing");
    expect(error.hint).toContain("bdk check plan");
    files.data.set(`${ROOT}/${RUN}/checks/07/plan.json`, "{");
    expect(failure(() => record(deps, { id: "07" })).code).toBe("env/plan-missing");
    files.data.set(`${ROOT}/${RUN}/checks/07/plan.json`, '{"version":9}');
    expect(failure(() => record(deps, { id: "07" })).code).toBe("env/plan-missing");
  });

  it("refuses --changed outside a git work tree", () => {
    const { deps } = project(SETTINGS, {});
    expect(failure(() => planCheckRun(deps, input({ changed: "HEAD" }))).code).toBe(
      "env/not-a-repo",
    );
  });

  it("refuses a missing run directory", () => {
    const { deps } = project();
    for (const action of [
      () => planCheckRun(deps, input({ runDir: ".bdk/runs/nope" })),
      () => recordChecks(deps, { runDir: ".bdk/runs/nope", id: "02" }),
    ]) {
      const error = failure(action);
      expect(error.code).toBe("env/run-dir-missing");
      expect(error.message).toContain(".bdk/runs/nope");
    }
  });

  it("refuses a project that is not configured, pointing at /bdk:setup", () => {
    const { files, deps } = project();
    files.data.delete(`${ROOT}/.bdk/settings.yaml`);
    const error = failure(() => planCheckRun(deps, input()));
    expect(error.code).toBe("env/not-configured");
    expect(error.hint).toContain("/bdk:setup");
  });

  it("refuses an invalid configuration, pointing at bdk config check", () => {
    const { deps } = project("tools:\n  test:\n    - id: unit\n      timeout: 0\n");
    const error = failure(() => planCheckRun(deps, input()));
    expect(error.code).toBe("env/config-invalid");
    expect(error.message).toContain("tools.test.unit");
    expect(error.hint).toContain("bdk config check");
  });
});
