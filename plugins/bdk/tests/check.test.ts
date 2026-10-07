import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkGroup } from "../src/check/index.ts";
import { runResult } from "../src/check/schema/run.ts";
import { run } from "../src/shared/cli/index.ts";
import { files } from "../src/shared/fs/index.ts";
import { shell } from "../src/shared/shell/index.ts";

// Spec `bdk-cli/check` end to end: the frame, the slice, the config and findings slices, and the
// file system and shell boundaries against a temporary project, the way `src/main.ts` wires them.

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
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const code = await run({
    argv: args,
    version: "0.0.0",
    nodeVersion: process.versions.node,
    groups: [
      checkGroup({ files, cwd, home: project, env: {}, shell: (line, opts) => shell(line, opts) }),
    ],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

const LIST_ARGS = `tools:
  test:
    - id: args
      command: echo full
      scoped: "printf '[%s]' {files}"
  lint:
    - id: stdin
      command: "cat; echo read-eof"
`;

describe("bdk check run", () => {
  it("runs scoped and full commands and writes the result and output files", async () => {
    settings(LIST_ARGS);
    const { code, stdout, stderr } = await bdk([
      "check",
      "run",
      RUN,
      "01",
      "--scope",
      "src/b c.ts",
      "--scope",
      "src/it's.ts",
      "--json",
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toBe(read(`${RUN}/checks/01.json`));
    const result = runResult.parse(JSON.parse(stdout));
    expect(result).toMatchObject({
      verdict: "pass",
      scope: ["src/b c.ts", "src/it's.ts"],
      checks: [
        {
          kind: "test",
          tool: "args",
          command: "printf '[%s]' 'src/b c.ts' 'src/it'\\''s.ts'",
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

  it("reports a red check in text with its tail and exits 1", async () => {
    settings(`tools:
  lint:
    - id: eslint
      command: "echo 'src/a.ts: 1 problem' >&2; exit 2"
  build:
    - id: tsc
      command: "echo built"
`);
    const { code, stdout, stderr } = await bdk(["check", "run", RUN, "02"]);
    expect({ code, stderr }).toEqual({ code: 1, stderr: "" });
    expect(stdout).toBe(
      [
        `fail  lint eslint  full    ${RUN}/checks/02/lint-eslint.txt`,
        "    | src/a.ts: 1 problem",
        `pass  build tsc    full    ${RUN}/checks/02/build-tsc.txt`,
        "verdict: fail (1 of 2 red)",
        `result: ${RUN}/checks/02.json`,
        "",
      ].join("\n"),
    );
    expect(read(`${RUN}/checks/02/lint-eslint.txt`)).toBe("src/a.ts: 1 problem\nexit 2\n");
  });

  it("kills a command at its timeout and appends the red check to the round", async () => {
    settings(`tools:
  test:
    - id: slow
      command: "echo started; sleep 30"
      timeout: 1
`);
    const started = Date.now();
    const { code, stdout } = await bdk(["check", "run", RUN, "round-1", "--round", "1", "--json"]);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(code).toBe(1);
    const result = runResult.parse(JSON.parse(stdout));
    expect(result.checks[0]).toMatchObject({ status: "timeout", exit: null, tail: ["started"] });
    expect(read(`${RUN}/checks/round-1/test-slow.txt`)).toBe("started\ntimeout 1\n");
    const log = read(`${RUN}/review/round-1/findings.jsonl`);
    expect(JSON.parse(log)).toMatchObject({
      type: "finding",
      id: result.findings?.ids[0],
      source: "check-run",
      rule: "check/test/slow",
      summary: "test slow timed out after 1 s",
    });
  });

  it("gives byte-identical output for the same commands and outputs", async () => {
    settings(LIST_ARGS);
    const first = await bdk(["check", "run", RUN, "03", "--scope", "a.ts", "--json"]);
    const second = await bdk(["check", "run", RUN, "03", "--scope", "a.ts", "--json"]);
    expect(second.stdout).toBe(first.stdout);
  });

  it("shows --scope and --kind as repeatable in its help", async () => {
    const { code, stdout } = await bdk(["check", "run", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^ {2}--scope <value> +.* \(repeatable\)$/m);
    expect(stdout).toMatch(/^ {2}--kind <value> +.* \(repeatable\)$/m);
    expect(stdout).toContain("Usage: bdk check run <run-dir> <id> [flags]");
  });

  it("refuses to run in a project that is not configured", async () => {
    const { code, stdout } = await bdk(["check", "run", RUN, "01", "--json"]);
    expect(code).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "env/not-configured" } });
  });
});
