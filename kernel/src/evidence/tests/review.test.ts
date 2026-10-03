// The evidence of a review round (`kernel-cli/evidence`; T42-A1, D5): a
// grouped `evidence record` on the round's ticket, and `bdk evidence
// coverage`, which measures the lines the Change adds and decides the verdict.
import { describe, expect, it } from "vitest";

import { readDocument, writeDocument } from "../../shared/store/index.ts";
import { evidenceCoverageOutput } from "../schema/outputs.ts";
import { treeOf } from "../use-cases/tree.ts";
import { DIR, REL, ROOT, record, refusal, started, ticketOf } from "./support.ts";
import type { Harness } from "./support.ts";

const CHANGE = "2026-09-25-login";
const ROUND = "A-r1v2w3x4";
const BASE = "1111111111111111111111111111111111111111";
const ADDED_BY = "2222222222222222222222222222222222222222";
const SUMMARY = JSON.stringify({ numFailedTests: 0, numPassedTests: 40 });

const TOOLS =
  "tools:\n" +
  "  test:\n" +
  "    - id: unit\n      tier: fast\n      command: vitest run\n" +
  "      coverage:\n        command: vitest run --coverage\n        report: coverage/lcov.info\n        format: lcov\n        min: 90\n" +
  "    - id: e2e\n      tier: e2e\n      command: playwright test\n" +
  "      coverage:\n        command: playwright test\n        report: coverage/cobertura.xml\n        format: cobertura\n" +
  "    - id: smoke\n      tier: e2e\n      command: smoke run\n";

/** The diff of the Change against its base: 20 lines added to the login module, a doc and a Change file. */
const DIFF = [
  "--- a/src/01-1.ts",
  "+++ b/src/01-1.ts",
  "@@ -1,0 +2,20 @@",
  ...Array.from({ length: 20 }, (_, at) => `+line ${String(at)}`),
  "--- a/docs/guide.md",
  "+++ b/docs/guide.md",
  "@@ -1,0 +1,1 @@",
  "+text",
  `--- a/${REL}/change.md`,
  `+++ b/${REL}/change.md`,
  "@@ -0,0 +1,1 @@",
  "+---",
  "",
].join("\n");

/** 17 of the 20 added lines hit: lines 5, 10 and 18 are not. */
function lcov(missed: readonly number[] = [5, 10, 18]): string {
  const lines = Array.from({ length: 20 }, (_, at) => at + 2);
  return [
    "SF:src/01-1.ts",
    "DA:1,1",
    ...lines.map((line) => `DA:${String(line)},${missed.includes(line) ? "0" : "3"}`),
    "end_of_record",
    "",
  ].join("\n");
}

/** A `review-fix` round on the Change with the gate runner's group package; git answers the base and diff. */
async function round(diff = DIFF, untracked: readonly string[] = []): Promise<Harness> {
  const h = await started();
  h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOLS);
  writeDocument(h.store, `${DIR}/attempts/review-fix-${CHANGE}-${ROUND}.md`, {
    data: {
      schema: 1,
      ticket: ROUND,
      loop: "review-fix",
      target: CHANGE,
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:30:00.000Z",
      author: "BDK Test <test@example.com>",
    },
    body: "",
  });
  const name = `${CHANGE}-runner-${ROUND}-gate.md`;
  writeDocument(h.store, `${DIR}/dispatch/${name}`, {
    data: {
      schema: 1,
      ticket: ROUND,
      target: CHANGE,
      role: "runner",
      adapter: "runner",
      attempt: 1,
      of: 2,
      scope: "full",
      at: "2026-09-25T10:31:00.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `${REL}/reports/${name}`,
      rules: [],
      group: "gate",
      files: [],
    },
    body: "",
  });
  const run = h.git.run.bind(h.git);
  const ok = (stdout: string) => Promise.resolve({ code: 0, stdout, stderr: "" });
  h.git.run = (args, cwd) => {
    if (args[0] === "log") return ok(`${ADDED_BY}\n`);
    if (args[0] === "rev-parse") return ok(`${BASE}\n`);
    if (args[0] === "-c" && args.includes("diff")) {
      expect(args).toContain(BASE);
      return ok(diff);
    }
    if (args[0] === "ls-files" && !args.includes("-c")) {
      return ok(untracked.map((path) => `${path}\0`).join(""));
    }
    return run(args, cwd);
  };
  return h;
}

function coverage(h: Harness, ...argv: string[]) {
  return h.step(["evidence", "coverage", ...argv, "--json"]);
}

function manifest(h: Harness, id: string): Record<string, unknown> {
  const document = readDocument(h.store, `${DIR}/evidence/${CHANGE}-${id}.md`);
  if (document === undefined || !("data" in document)) throw new Error(`no manifest ${id}`);
  return document.data;
}

function manifests(h: Harness): string[] {
  return h.store.list(`${DIR}/evidence`).filter((name) => name.endsWith(".md"));
}

describe("evidence record under a group reference", () => {
  it("stamps the group, the group package's role and the Change tree hash", async () => {
    const h = await round();
    h.put(".bdk/.machine/evidence/full.json", SUMMARY);
    const result = await record(
      h,
      "tests-full",
      ".bdk/.machine/evidence/full.json",
      "--ticket",
      `${ROUND}@gate`,
      "--verdict",
      "pass",
      "--cite",
      "/numFailedTests",
    );
    expect(result.code, result.stdout).toBe(0);
    const out = result.json as { evidence: string; treeHash: string };
    const tree = treeOf(["src/01-1.ts", "src/01-2.ts", "src/02-1.ts"], (path) =>
      h.store.readBytes(`${ROOT}/${path}`),
    );
    expect(out.treeHash).toBe(tree.treeHash);
    expect(manifest(h, out.evidence)).toMatchObject({
      kind: "tests-full",
      ticket: ROUND,
      target: CHANGE,
      group: "gate",
      source: "agent:runner",
    });
  });

  it("refuses a group without a package", async () => {
    const h = await round();
    h.put(".bdk/.machine/evidence/full.json", SUMMARY);
    const result = await record(
      h,
      "lint-full",
      ".bdk/.machine/evidence/full.json",
      "--ticket",
      `${ROUND}@p09`,
    );
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/no-open-ticket");
  });

  it("refuses the kind coverage, naming bdk evidence coverage", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const result = await record(h, "coverage", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/invalid-argument");
    expect(refusal(result).why).toContain("bdk evidence coverage");
  });
});

describe("evidence coverage", () => {
  it("fails 17 of 20 added lines against min 90 and records the summary and the report", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.code, result.stdout).toBe(0);
    const out = evidenceCoverageOutput.parse(result.json);
    expect(out).toStrictEqual({
      evidence: out.evidence,
      tool: "unit",
      min: 90,
      percent: 85,
      covered: 17,
      total: 20,
      unmeasured: [],
      verdict: "fail",
    });
    const data = manifest(h, out.evidence) as {
      files: { path: string }[];
      citations: string[];
    };
    expect(data).toMatchObject({
      kind: "coverage",
      tool: "unit",
      group: "gate",
      target: CHANGE,
      source: "agent:runner",
      verdict: "fail",
      citations: ["coverage-unit.json#/percent"],
    });
    const [summary, report] = data.files;
    expect(report?.path).toMatch(/-lcov\.info$/);
    const stored = JSON.parse(h.store.read(`${ROOT}/${summary?.path ?? ""}`) ?? "{}") as unknown;
    expect(stored).toMatchObject({
      test: "unit",
      format: "lcov",
      min: 90,
      percent: 85,
      files: [{ path: "src/01-1.ts", covered: 17, total: 20, uncovered: [5, 10, 18] }],
      unmeasured: [],
    });
  });

  it("passes at or above min", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov([5]));
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.json).toMatchObject({ percent: 95, verdict: "pass" });
  });

  it("passes without min and reports the percent", async () => {
    const h = await round();
    const xml = `<coverage><class filename="src/01-1.ts"><lines>${Array.from(
      { length: 20 },
      (_, at) => `<line number="${String(at + 2)}" hits="${at < 8 ? "1" : "0"}"/>`,
    ).join("")}</lines></class></coverage>\n`;
    h.put("coverage/cobertura.xml", xml);
    const result = await coverage(h, "e2e", "coverage/cobertura.xml", "--ticket", `${ROUND}@gate`);
    expect(result.json).toMatchObject({ min: null, percent: 40, verdict: "pass" });
  });

  it("counts an untracked file whole and lists an executable file the report omits as unmeasured", async () => {
    const h = await round(DIFF, ["src/02-1.ts"]);
    h.put("coverage/lcov.info", lcov());
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.json).toMatchObject({ total: 20, unmeasured: ["src/02-1.ts"] });
  });

  it("never counts the measured report as a changed file", async () => {
    const h = await round(DIFF, ["coverage/lcov.info"]);
    h.put("coverage/lcov.info", lcov());
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.json).toMatchObject({ total: 20, unmeasured: [] });
  });

  it("returns the earlier manifest for the same report and tree", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const first = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    const second = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect((second.json as { evidence: string }).evidence).toBe(
      (first.json as { evidence: string }).evidence,
    );
    expect(manifests(h)).toHaveLength(1);
  });

  it.each([
    ["an unknown test id", ["nope", "coverage/lcov.info"], 3, "input/not-found"],
    ["a missing report", ["unit", "coverage/none.info"], 3, "input/not-found"],
    ["an entry without coverage", ["smoke", "coverage/lcov.info"], 3, "input/invalid-argument"],
  ])("refuses %s", async (_, args, code, rule) => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const result = await coverage(h, ...args, "--ticket", `${ROUND}@gate`);
    expect(result.code).toBe(code);
    expect(refusal(result).rule).toBe(rule);
    expect(manifests(h)).toStrictEqual([]);
  });

  it("refuses a report of another format, naming the expected one, and records nothing", async () => {
    const h = await round();
    h.put("coverage/lcov.info", '<?xml version="1.0"?>\n<coverage></coverage>\n');
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", `${ROUND}@gate`);
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-argument" });
    expect(refusal(result).why).toContain("lcov");
    expect(manifests(h)).toStrictEqual([]);
  });

  it("refuses a ticket whose target is a task", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const ticket = await ticketOf(h);
    const result = await coverage(h, "unit", "coverage/lcov.info", "--ticket", ticket);
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/no-open-ticket");
  });

  it("refuses without --ticket", async () => {
    const h = await round();
    h.put("coverage/lcov.info", lcov());
    const result = await coverage(h, "unit", "coverage/lcov.info");
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/missing-argument");
  });
});
