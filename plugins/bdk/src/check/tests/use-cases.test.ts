import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import { renderRun } from "../render/run.ts";
import { runResult } from "../schema/run.ts";
import { runChecks } from "../use-cases/run.ts";
import type { RunInput } from "../use-cases/run.ts";
import { fakeGit, fakeShell, memory, ROOT, RUN } from "./memory.ts";
import type { Script } from "./memory.ts";

// `bdk check run` against an in-memory file system and a fake shell (spec `bdk-cli/check`).

const SETTINGS = `tools:
  test:
    - id: unit
      command: vitest run {files}
  lint:
    - id: eslint
      command: eslint .
      timeout: 30
`;

/** The answers of a clean repository at `ROOT`, `HEAD` resolving. */
const REPO: Record<string, string> = {
  "rev-parse --is-inside-work-tree": "true\n",
  "rev-parse --verify --quiet HEAD^{commit}": "abc\n",
  "diff --name-only --relative --no-renames --no-ext-diff --diff-filter=d -z HEAD --": "",
  "ls-files --others --exclude-standard -z": "",
};

function project(
  settings = SETTINGS,
  scripts: Record<string, Script> = {},
  answers: Record<string, string> = REPO,
) {
  const files = memory({
    [`${ROOT}/.bdk/settings.yaml`]: settings,
    [`${ROOT}/openspec/config.yaml`]: "schema: spec-driven\n",
    [`${ROOT}/${RUN}/state.json`]: "{}",
  });
  const shell = fakeShell(files, scripts);
  const git = fakeGit(answers);
  const deps = { files, shell, git, cwd: ROOT, home: "/home/me", env: {} };
  return { files, shell, git, deps };
}

const input = (extra: Partial<RunInput> = {}): RunInput => ({ runDir: RUN, id: "02", ...extra });

async function check(deps: Parameters<typeof runChecks>[0], value: RunInput) {
  return (await runChecks(deps, value)).result;
}

async function failure(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error("expected a CliError");
}

describe("runChecks", () => {
  it("runs scoped and full commands in the project root and writes the result file", async () => {
    const { files, shell, deps } = project();
    const result = await check(deps, input({ scope: ["src/b.ts", "src/a.ts"] }));
    expect(shell.calls).toEqual([
      {
        command: "vitest run src/a.ts src/b.ts",
        cwd: ROOT,
        output: `${ROOT}/${RUN}/checks/02/test-unit.txt`,
        timeout: 600,
      },
      {
        command: "eslint .",
        cwd: ROOT,
        output: `${ROOT}/${RUN}/checks/02/lint-eslint.txt`,
        timeout: 30,
      },
    ]);
    expect(result).toEqual({
      version: 2,
      id: "02",
      at: null,
      changed: null,
      scope: ["src/a.ts", "src/b.ts"],
      verdict: "pass",
      checks: [
        {
          kind: "test",
          tool: "unit",
          command: "vitest run src/a.ts src/b.ts",
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
    expect(runResult.parse(result)).toEqual(result);
    expect((await runChecks(deps, input({ scope: ["src/a.ts", "src/b.ts"] }))).file).toBe(
      `${RUN}/checks/02.json`,
    );
    expect(files.data.get(`${ROOT}/${RUN}/checks/02.json`)).toBe(`${JSON.stringify(result)}\n`);
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/test-unit.txt`)).toBe("exit 0\n");
  });

  it("runs every command after a red one, keeps the tail and fails the verdict", async () => {
    const { files, deps } = project(SETTINGS, {
      "vitest run src/a.ts": {
        output: "FAIL a.test.ts\n1 failed",
        outcome: { kind: "exit", code: 1 },
      },
      "eslint .": { output: "", outcome: { kind: "timeout" } },
    });
    const result = await check(deps, input({ scope: ["src/a.ts"] }));
    expect(result.verdict).toBe("fail");
    expect(result.checks.map((check) => [check.status, check.exit, check.tail])).toEqual([
      ["fail", 1, ["FAIL a.test.ts", "1 failed"]],
      ["timeout", null, []],
    ]);
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/test-unit.txt`)).toBe(
      "FAIL a.test.ts\n1 failed\nexit 1\n",
    );
    expect(files.data.get(`${ROOT}/${RUN}/checks/02/lint-eslint.txt`)).toBe("timeout 30\n");
  });

  it("gives each entry only the scope paths its paths match and skips one with none", async () => {
    const { files, shell, deps } = project(`tools:
  test:
    - id: api
      command: uv run pytest {files}
      paths: ["api/**"]
    - id: web
      command: pnpm vitest run {files}
      paths: ["web/**"]
`);
    const result = await check(deps, input({ scope: ["web/src/a.tsx"] }));
    expect(shell.calls.map((call) => call.command)).toEqual(["pnpm vitest run web/src/a.tsx"]);
    expect(result).toMatchObject({
      verdict: "pass",
      checks: [{ kind: "test", tool: "web", scoped: true }],
      skipped: [{ kind: "test", tool: "api", reason: "paths" }],
    });
    expect(runResult.parse(result)).toEqual(result);
    expect(files.data.has(`${ROOT}/${RUN}/checks/02/test-api.txt`)).toBe(false);
  });

  it("writes verdict none when every entry is skipped", async () => {
    const { shell, deps } = project(`tools:
  lint:
    - id: ruff
      command: ruff check .
      paths: ["**/*.py"]
`);
    const { result, file } = await runChecks(deps, input({ scope: ["web/src/a.tsx"] }));
    expect(shell.calls).toEqual([]);
    expect(result).toMatchObject({
      verdict: "none",
      checks: [],
      skipped: [{ kind: "lint", tool: "ruff", reason: "paths" }],
    });
    expect(renderRun(result, file)).toBe(
      [
        "skip  lint ruff  no changed file matches its paths",
        "verdict: none",
        `result: ${RUN}/checks/02.json`,
        "",
      ].join("\n"),
    );
  });

  it("runs only the entries of the point asked for, and those without when", async () => {
    const { shell, deps } = project(`tools:
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
    const wave = await check(deps, input({ id: "wave-1", at: "wave", scope: ["src/a.ts"] }));
    expect(shell.calls.map((call) => call.command)).toEqual(["vitest run", "node smoke.js"]);
    expect(wave).toMatchObject({ at: "wave", skipped: [] });
    shell.calls.length = 0;
    const part = await check(deps, input({ at: "part", scope: ["src/a.ts"] }));
    expect(shell.calls.map((call) => call.command)).toEqual([
      "vitest related --run src/a.ts",
      "node smoke.js",
    ]);
    expect(runResult.parse(part)).toEqual(part);
  });

  it("adds the files git reports changed against a revision to the scope", async () => {
    const { shell, git, deps } = project(
      SETTINGS,
      {},
      {
        ...REPO,
        "diff --name-only --relative --no-renames --no-ext-diff --diff-filter=d -z HEAD --":
          "src/a.ts\0src/c.ts\0",
        "ls-files --others --exclude-standard -z": "test/a.test.ts\0",
      },
    );
    const result = await check(deps, input({ changed: "HEAD", scope: ["src/a.ts", "docs/x.md"] }));
    expect(shell.calls[0]?.command).toBe("vitest run docs/x.md src/a.ts src/c.ts test/a.test.ts");
    expect(result).toMatchObject({
      changed: "HEAD",
      scope: ["docs/x.md", "src/a.ts", "src/c.ts", "test/a.test.ts"],
    });
    expect(new Set(git.calls.map((call) => call.cwd))).toEqual(new Set([ROOT]));
  });

  it("skips a {files} entry with reason no-files when nothing changed", async () => {
    const { shell, deps } = project();
    const { result, file } = await runChecks(deps, input({ at: "part", changed: "HEAD" }));
    expect(shell.calls.map((call) => call.command)).toEqual(["eslint ."]);
    expect(result).toMatchObject({
      at: "part",
      changed: "HEAD",
      scope: null,
      skipped: [{ kind: "test", tool: "unit", reason: "no-files" }],
    });
    expect(renderRun(result, file).split("\n").slice(0, 3)).toEqual([
      "at part, changed against HEAD",
      `pass  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
      "skip  test unit    no changed file for its {files}",
    ]);
  });

  it("runs only the kinds asked for", async () => {
    const { shell, deps } = project();
    const result = await check(deps, input({ kinds: ["lint"] }));
    expect(shell.calls.map((call) => call.command)).toEqual(["eslint ."]);
    expect(result.checks.map((check) => check.kind)).toEqual(["lint"]);
  });

  it("writes a result with verdict none when nothing is configured", async () => {
    const { files, shell, deps } = project("languages: [typescript]\n");
    const result = await check(deps, input());
    expect(shell.calls).toEqual([]);
    expect(result).toMatchObject({ verdict: "none", checks: [] });
    expect(files.data.has(`${ROOT}/${RUN}/checks/02.json`)).toBe(true);
  });

  it("replaces an earlier result of the same id", async () => {
    const { files, deps } = project(SETTINGS, {
      "eslint .": { output: "x", outcome: { kind: "exit", code: 1 } },
    });
    await check(deps, input());
    files.data.set(`${ROOT}/.bdk/settings.yaml`, "languages: []\n");
    await check(deps, input());
    const saved = JSON.parse(files.data.get(`${ROOT}/${RUN}/checks/02.json`) ?? "") as unknown;
    expect(saved).toMatchObject({ verdict: "none" });
  });

  it("resolves the run directory from the working directory and keeps an absolute one", async () => {
    const { shell, deps } = project();
    const result = await check(
      { ...deps, cwd: `${ROOT}/src` },
      input({ runDir: `${ROOT}/${RUN}`, kinds: ["lint"] }),
    );
    expect(shell.calls[0]).toMatchObject({
      cwd: ROOT,
      output: `${ROOT}/${RUN}/checks/02/lint-eslint.txt`,
    });
    expect(result.checks[0]?.output).toBe(`${ROOT}/${RUN}/checks/02/lint-eslint.txt`);
  });
});

describe("red checks as findings", () => {
  const red = {
    "eslint .": { output: "1 problem\n", outcome: { kind: "exit", code: 1 } },
  } as const;
  const LOG = `${ROOT}/${RUN}/review/round-2/findings.jsonl`;

  it("appends one finding per red check with a stable id", async () => {
    const { files, deps } = project(SETTINGS, red);
    const first = await check(deps, input({ id: "round-2", round: "2" }));
    const second = await check(deps, input({ id: "round-2", round: "2" }));
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

  it("appends nothing when every check passes", async () => {
    const { files, deps } = project();
    const result = await check(deps, input({ round: "2" }));
    expect(result.findings).toEqual({ log: `${RUN}/review/round-2/findings.jsonl`, ids: [] });
    expect(files.data.has(LOG)).toBe(false);
  });
});

describe("errors before any command runs", () => {
  it.each([
    [{ id: "Part-2" }, "<id>"],
    [{ kinds: ["tests"] }, "tests"],
    [{ round: "0" }, "--round"],
    [{ round: "2a" }, "--round"],
    [{ scope: ["a.ts", ""] }, "--scope"],
    [{ at: "merge" }, "part, wave or review"],
    [{ changed: "no-such-branch" }, "no-such-branch"],
    [{ changed: "--output=x" }, "--output=x"],
  ])("refuses %j as usage/invalid-argument", async (extra, named) => {
    const { files, shell, deps } = project();
    const before = new Map(files.data);
    const error = await failure(runChecks(deps, input(extra)));
    expect(error.code).toBe("usage/invalid-argument");
    expect(error.message).toContain(named);
    expect(shell.calls).toEqual([]);
    expect(files.data).toEqual(before);
  });

  it("names the kinds for an unknown one", async () => {
    const error = await failure(runChecks(project().deps, input({ kinds: ["tests"] })));
    expect(error.message).toContain("test, lint or build");
  });

  it("refuses --changed outside a git work tree", async () => {
    const { shell, deps } = project(SETTINGS, {}, {});
    const error = await failure(runChecks(deps, input({ changed: "HEAD" })));
    expect(error.code).toBe("env/not-a-repo");
    expect(shell.calls).toEqual([]);
  });

  it("refuses a missing run directory", async () => {
    const { shell, deps } = project();
    const error = await failure(runChecks(deps, input({ runDir: ".bdk/runs/nope" })));
    expect(error.code).toBe("env/run-dir-missing");
    expect(error.message).toContain(".bdk/runs/nope");
    expect(shell.calls).toEqual([]);
  });

  it("refuses a project that is not configured, pointing at /bdk:setup", async () => {
    const { files, deps } = project();
    files.data.delete(`${ROOT}/.bdk/settings.yaml`);
    const error = await failure(runChecks(deps, input()));
    expect(error.code).toBe("env/not-configured");
    expect(error.hint).toContain("/bdk:setup");
  });

  it("refuses an invalid configuration, pointing at bdk config check", async () => {
    const { deps } = project("tools:\n  test:\n    - id: unit\n      timeout: 0\n");
    const error = await failure(runChecks(deps, input()));
    expect(error.code).toBe("env/config-invalid");
    expect(error.message).toContain("tools.test.unit");
    expect(error.hint).toContain("bdk config check");
  });
});
