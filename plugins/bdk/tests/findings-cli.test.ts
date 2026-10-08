import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { build } from "../build.ts";
import { listResult } from "../src/findings/schema/list.ts";

// Acceptance of #187 against the built CLI run through `bin/bdk` (spec `bdk-cli/findings`,
// "Parallel writers lose no line" and "Fold the log"): real processes, a real file.

const PLUGIN = join(import.meta.dirname, "..");

let root: string;
let bdk: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "bdk-findings-"));
  for (const dir of [".claude-plugin", "bin"]) {
    cpSync(join(PLUGIN, dir), join(root, "plugin", dir), { recursive: true });
  }
  await build({ outfile: join(root, "plugin", "dist", "bdk.mjs") });
  bdk = join(root, "plugin", "bin", "bdk");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function start(args: readonly string[]): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bdk, args, { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout });
    });
  });
}

function sync(args: readonly string[]): { status: number | null; stdout: string } {
  const { status, stdout } = spawnSync(bdk, args, { cwd: root, encoding: "utf8" });
  return { status, stdout };
}

describe("bdk findings, built", () => {
  it("loses no line when 50 add calls run at the same time", async () => {
    const log = join(root, "runs", "parallel", "review", "round-1", "findings.jsonl");
    const evidence = "x".repeat(2000);
    const runs = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        start([
          "findings",
          "add",
          log,
          "--source",
          `group-${i % 5}`,
          "--summary",
          `finding ${i}`,
          "--file",
          `src/f${i}.ts`,
          "--line",
          String(i + 1),
          "--evidence",
          evidence,
        ]),
      ),
    );
    expect(runs.every((run) => run.code === 0)).toBe(true);
    const lines = readFileSync(log, "utf8").split("\n");
    expect(lines.pop()).toBe("");
    expect(lines).toHaveLength(50);
    for (const line of lines) expect(() => JSON.parse(line) as unknown).not.toThrow();
    const ids = new Set(runs.map((run) => run.stdout.trim()));
    expect(ids.size).toBe(50);
    const listed = sync(["findings", "list", log, "--json"]);
    expect(listed.status).toBe(0);
    const result = listResult.parse(JSON.parse(listed.stdout));
    expect(result.counts.findings).toBe(50);
    expect(result.skipped).toEqual([]);
    expect(new Set(result.findings.map((f) => f.id))).toEqual(ids);
  });

  it("lists a finding with its latest level and decision", () => {
    const log = join(root, "runs", "latest", "review", "round-1", "findings.jsonl");
    const id = sync([
      "findings",
      "add",
      log,
      "--source",
      "review-group",
      "--summary",
      "s",
    ]).stdout.trim();
    for (const args of [
      ["level", log, id, "should-fix"],
      ["decide", log, id, "defer", "--issue", "#9"],
      ["level", log, id, "blocker"],
      ["decide", log, id, "fix"],
    ]) {
      expect(sync(["findings", ...args]).status).toBe(0);
    }
    const listed = sync(["findings", "list", log, "--decision", "fix", "--json"]);
    const [finding] = listResult.parse(JSON.parse(listed.stdout)).findings;
    expect(finding).toMatchObject({ id, level: "blocker", decision: "fix" });
    expect(finding).not.toHaveProperty("issue");
  });

  it("writes review.md next to the log", () => {
    const log = join(root, "runs", "report", "review", "round-1", "findings.jsonl");
    const id = sync([
      "findings",
      "add",
      log,
      "--source",
      "review-group",
      "--summary",
      "s",
    ]).stdout.trim();
    expect(sync(["findings", "level", log, id, "blocker"]).status).toBe(0);
    const report = join(dirname(log), "review.md");
    expect(sync(["findings", "report", log])).toMatchObject({ status: 0 });
    expect(readFileSync(report, "utf8")).toContain(`## blocker\n\n- ${id} - s (review-group)\n`);
  });
});
