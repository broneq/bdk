import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planGroup } from "../src/plan/index.ts";
import { checkResult } from "../src/plan/schema/check.ts";
import { run } from "../src/shared/cli/index.ts";
import { files } from "../src/shared/fs/index.ts";

// Spec `bdk-cli/plan` end to end: the frame, the slice, the config slice and the file system
// boundary against a temporary configured project, the way `src/main.ts` wires them. Covers
// the acceptance signal of #185: an oversized part, a cycle and an overlap each reported with
// the part id, and the waves printed in order.

const PARTS = "openspec/changes/x/plan/parts";

let project: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(project, path)), { recursive: true });
  writeFileSync(join(project, path), text);
}

function part(
  id: string,
  { deps = [] as string[], files: paths = [`src/${id}.ts`], tasks = 2, pad = 0 } = {},
): void {
  write(
    `${PARTS}/${id}.md`,
    [
      "---",
      `id: "${id}"`,
      `depends-on: [${deps.map((dep) => `"${dep}"`).join(", ")}]`,
      "isolation: worktree",
      "files:",
      ...paths.map((path) => `  - ${path}`),
      "---",
      "",
      `# Part ${id}`,
      "",
      "## Tasks",
      "",
      ...Array.from({ length: tasks }, (_, i) => `${String(i + 1)}. task`),
      "x".repeat(pad),
      "",
    ].join("\n"),
  );
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
    groups: [planGroup({ files, cwd, home: join(project, "home"), env: {} })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "bdk-plan-e2e-"));
  write(".bdk/settings.yaml", "");
  write("openspec/config.yaml", "schema: bdk\n");
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("bdk plan check", () => {
  it("prints the waves in order and exits 0 for a clean plan", async () => {
    part("01");
    part("02", { deps: ["01"] });
    part("03", { deps: ["01"] });
    part("04", { deps: ["02", "03"] });
    const { code, stdout, stderr } = await bdk(["plan", "check", PARTS]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toMatch(
      /^plan: 4 parts, 3 waves, ok\nwaves:\n {2}1: 01\n {2}2: 02 03\n {2}3: 04\nparts:\n/,
    );
    expect(stdout).not.toMatch(/problems:/);
    expect((await bdk(["plan", "check", PARTS])).stdout).toBe(stdout);
  });

  it("reports an oversized part, a cycle and an overlap with their part ids and exits 1", async () => {
    part("01", { pad: 9000 });
    part("02", { deps: ["01"], files: ["src/shared.ts"] });
    part("03", { deps: ["01"], files: ["src/shared.ts", "src/b.ts"] });
    part("04", { deps: ["05"] });
    part("05", { deps: ["04"] });
    const { code, stdout } = await bdk(["plan", "check", PARTS]);
    expect(code).toBe(1);
    expect(stdout).toMatch(/^plan: 5 parts, 2 waves, 3 problems\n/);
    expect(stdout).toContain("waves:\n  1: 01\n  2: 02 03\n");
    const problems = stdout.split("problems:\n")[1]?.split("\n") ?? [];
    expect(problems[0]).toMatch(/^ {2}max-bytes 01: \d+ bytes, above plan\.part\.max-bytes 8192$/);
    expect(problems.slice(1)).toEqual([
      "  cycle 04,05: parts 04 and 05 depend on each other in a cycle",
      "  overlap 02,03: src/shared.ts is listed by 02 and 03 in wave 2",
      "",
    ]);
  });

  it("prints a JSON result that matches the schema", async () => {
    part("01", { tasks: 6 });
    const { code, stdout } = await bdk(["plan", "check", PARTS, "--json"]);
    expect(code).toBe(1);
    const result = checkResult.parse(JSON.parse(stdout));
    expect(result).toMatchObject({
      ok: false,
      limits: { maxTasks: 5, maxFiles: 10, maxBytes: 8192 },
      waves: [{ wave: 1, parts: ["01"] }],
      problems: [{ check: "max-tasks", parts: ["01"] }],
    });
  });

  it("takes a limit from the project settings", async () => {
    write(".bdk/settings.yaml", "plan:\n  part:\n    max-tasks: 7\n");
    part("01", { tasks: 6 });
    const { code, stdout } = await bdk(["plan", "check", PARTS]);
    expect(code).toBe(0);
    expect(stdout).toContain("tasks 6/7");
  });

  it("reports a missing directory and an unconfigured project with exit 3", async () => {
    expect(await bdk(["plan", "check", "plan/parts"])).toEqual({
      code: 3,
      stdout: "",
      stderr:
        "bdk: the plan directory plan/parts does not exist\nhint: Pass the plan/parts directory of the Change.\n",
    });
    rmSync(join(project, ".bdk"), { recursive: true });
    mkdirSync(join(project, ".git"));
    part("01");
    const { code, stderr } = await bdk(["plan", "check", PARTS]);
    expect(code).toBe(3);
    expect(stderr).toMatch(
      /^bdk: BDK is not configured in .+: \.bdk\/settings\.yaml missing\nhint: Run \/bdk:setup\.\n$/,
    );
  });

  it("prints the text a model reads for an oversized second part", async () => {
    part("01");
    part("02", { deps: ["01"], tasks: 6 });
    const { code, stdout } = await bdk(["plan", "check", PARTS]);
    expect(code).toBe(1);
    expect(stdout).toMatch(/^plan: 2 parts, 2 waves, 1 problem\nwaves:\n {2}1: 01\n {2}2: 02\n/);
    expect(stdout).toMatch(/\nproblems:\n {2}max-tasks 02: [^\n]+\n$/);
  });

  it("reports a cycle in the JSON result", async () => {
    part("01", { deps: ["02"] });
    part("02", { deps: ["01"] });
    const { code, stdout } = await bdk(["plan", "check", PARTS, "--json"]);
    expect(code).toBe(1);
    const result = checkResult.parse(JSON.parse(stdout));
    expect(result.ok).toBe(false);
    expect(result.waves).toEqual([]);
    expect(result.problems).toEqual([
      {
        check: "cycle",
        parts: ["01", "02"],
        message: "parts 01 and 02 depend on each other in a cycle",
      },
    ]);
  });

  it("names a missing argument as a usage error", async () => {
    expect((await bdk(["plan", "check"])).code).toBe(2);
  });
});
