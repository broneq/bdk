// `bdk evidence record` (`kernel-cli/evidence`; T23-D8, D45, D46, D47): the
// manifest with the tree hash of the ticket's target, committed and machine
// storage, the citation validator and the dedupe of a repeated call.
import { describe, expect, it } from "vitest";

import { readDocument } from "../../shared/store/index.ts";
import { sha256, treeOf } from "../use-cases/tree.ts";
import { DIR, REL, ROOT, record, refusal, started, ticketOf, withPackage } from "./support.ts";
import type { Harness } from "./support.ts";

interface Recorded {
  evidence: string;
  path: string;
  treeHash: string;
  files: { path: string; hash: string; stored: string }[];
  verdict?: string;
  citations?: string[];
  deduplicated: boolean;
}

const SUMMARY = JSON.stringify({ summary: { failed: 0, passed: 12 } });
const RUN = "running 12 tests\nall suites loaded\n12 passed, 0 failed\n";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function manifests(h: Harness): string[] {
  return h.store.list(`${DIR}/evidence`).filter((name) => name.endsWith(".md"));
}

function manifest(h: Harness, path: string): Record<string, unknown> {
  const document = readDocument(h.store, `${ROOT}/${path}`);
  if (document === undefined || !("data" in document)) throw new Error(`no manifest ${path}`);
  return document.data;
}

async function recordedPass(h: Harness, ticket: string): Promise<Recorded> {
  h.put(".bdk/.machine/evidence/01-1-tests.json", SUMMARY);
  const result = await record(
    h,
    "tests-scoped",
    ".bdk/.machine/evidence/01-1-tests.json",
    "--ticket",
    ticket,
    "--verdict",
    "pass",
    "--cite",
    "/summary/failed",
  );
  expect(result.code, result.stdout).toBe(0);
  return result.json as Recorded;
}

describe("evidence record", () => {
  it("resolves a project-relative citation of a file given by its absolute path", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put(".bdk/.machine/checks/tests-scoped.txt", RUN);
    const result = await record(
      h,
      "tests-scoped",
      `${ROOT}/.bdk/.machine/checks/tests-scoped.txt`,
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      ".bdk/.machine/checks/tests-scoped.txt:3=0 failed",
    );
    expect(result.code, result.stdout).toBe(0);
  });

  it("writes a manifest with the tree hash of the ticket's part and copies the small text file into the Change", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    const out = await recordedPass(h, ticket);

    expect(out.evidence).toMatch(/^E-[0-9a-z]{8}$/);
    expect(out.path).toBe(`${REL}/evidence/01-1-${out.evidence}.md`);
    const stored = `${REL}/evidence/01-1-${out.evidence}-01-1-tests.json`;
    expect(out.files).toEqual([
      { path: stored, hash: sha256(new TextEncoder().encode(SUMMARY)), stored: "committed" },
    ]);
    expect(h.store.read(`${ROOT}/${stored}`)).toBe(SUMMARY);
    expect(out).toMatchObject({
      verdict: "pass",
      citations: ["/summary/failed"],
      deduplicated: false,
    });

    const expected = treeOf(["src/01-1.ts", "src/01-2.ts"], (path) =>
      h.store.readBytes(`${ROOT}/${path}`),
    );
    expect(out.treeHash).toBe(expected.treeHash);
    expect(manifest(h, out.path)).toMatchObject({
      schema: 1,
      id: out.evidence,
      kind: "tests-scoped",
      ticket,
      target: "01-1",
      at: "2026-09-25T11:02:00.000Z",
      source: "kernel",
      "tree-hash": expected.treeHash,
      tree: expected.tree,
      files: out.files,
      verdict: "pass",
      citations: ["/summary/failed"],
    });
  });

  it("covers a build-config file of the work tree outside every Files: list", async () => {
    const h = await started();
    h.put("package.json", "{}\n");
    h.put("docs/login.md", "# Login\n");
    const out = await recordedPass(h, await ticketOf(h));
    const tree = manifest(h, out.path).tree as { path: string }[];
    expect(tree.map((entry) => entry.path)).toEqual(["package.json", "src/01-1.ts", "src/01-2.ts"]);
  });

  it("takes the source from the ticket's active package", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    withPackage(h, ticket, "runner");
    const out = await recordedPass(h, ticket);
    expect(manifest(h, out.path).source).toBe("agent:runner");
  });

  it("refuses a file that does not exist with input/not-found", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    const result = await record(h, "lint", "out/lint.txt", "--ticket", ticket, "--verdict", "fail");
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/not-found");
    expect(refusal(result).why).toContain("out/lint.txt");
    expect(manifests(h)).toEqual([]);
  });

  it("refuses an unknown ticket and a closed one with policy/no-open-ticket", async () => {
    const h = await started();
    h.put("lint.txt", "clean\n");
    const unknown = await record(h, "lint", "lint.txt", "--ticket", "A-zzzzzzzz");
    expect(unknown.code).toBe(2);
    expect(refusal(unknown).rule).toBe("policy/no-open-ticket");

    const ticket = await ticketOf(h);
    const closed = await h.step(["attempt", "close", ticket, "fail", "--json"]);
    expect(closed.code, closed.stdout).toBe(0);
    const late = await record(h, "lint", "lint.txt", "--ticket", ticket);
    expect(late.code).toBe(2);
    expect(refusal(late).rule).toBe("policy/no-open-ticket");
    expect(manifests(h)).toEqual([]);
  });

  it("requires --ticket", async () => {
    const h = await started();
    h.put("lint.txt", "clean\n");
    const result = await record(h, "lint", "lint.txt");
    expect(refusal(result).rule).toBe("input/missing-argument");
  });

  it("refuses a kind that is not kebab-case", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("lint.txt", "clean\n");
    const result = await record(h, "Tests_Scoped", "lint.txt", "--ticket", ticket);
    expect(refusal(result).rule).toBe("input/invalid-argument");
  });

  it("refuses two files with the same file name", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("a/out.txt", "a\n");
    h.put("b/out.txt", "b\n");
    const result = await record(h, "lint", "a/out.txt", "b/out.txt", "--ticket", ticket);
    expect(refusal(result).rule).toBe("input/invalid-argument");
    expect(refusal(result).why).toContain("out.txt");
  });

  it("refuses pass without a citation and writes nothing", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("out.json", SUMMARY);
    const result = await record(
      h,
      "tests-scoped",
      "out.json",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
    );
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/missing-citation");
    expect(h.store.list(`${DIR}/evidence`)).toEqual([]);
  });

  it("resolves each citation form", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("summary.json", SUMMARY);
    h.put("run.txt", RUN);
    const citations = ["summary.json#/summary/failed", "run.txt:3", "run.txt:3=0 failed"];
    const result = await record(
      h,
      "tests-scoped",
      "summary.json",
      "run.txt",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      ...citations.flatMap((citation) => ["--cite", citation]),
    );
    expect(result.code, result.stdout).toBe(0);
    const out = result.json as Recorded;
    expect(out.citations).toEqual(citations);
    expect(manifest(h, out.path).citations).toEqual(citations);
  });

  it("refuses a citation that does not resolve, naming it and the file, and writes nothing", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("run.txt", RUN);
    h.put("big.bin", PNG);
    const result = await record(
      h,
      "tests-scoped",
      "run.txt",
      "big.bin",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "run.txt:3=2 failed",
    );
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/missing-citation");
    expect(refusal(result).why).toContain("run.txt:3=2 failed");
    expect(refusal(result).why).toContain("run.txt");
    expect(h.store.list(`${DIR}/evidence`)).toEqual([]);
    expect(h.store.list(`${ROOT}/.bdk/.machine/evidence`)).toEqual([]);
  });

  it("hints the grammar form when a pass cites a console line as bare text", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("run.txt", RUN);
    const result = await record(
      h,
      "tests-scoped",
      "run.txt",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "12 passed, 0 failed",
    );
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/missing-citation");
    expect(refusal(result).instead[0]).toBe("--cite run.txt:3=12 passed, 0 failed");
    expect(h.store.list(`${DIR}/evidence`)).toEqual([]);
  });

  it("hints the right line when a citation guesses the wrong one", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("run.txt", RUN);
    const result = await record(
      h,
      "tests-scoped",
      "run.txt",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "run.txt:1=12 passed, 0 failed",
    );
    expect(refusal(result).rule).toBe("policy/missing-citation");
    expect(refusal(result).instead[0]).toBe("--cite run.txt:3=12 passed, 0 failed");
  });

  it("gives the grammar forms only when the bare text is on no line", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("run.txt", RUN);
    const result = await record(
      h,
      "tests-scoped",
      "run.txt",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "13 passed",
    );
    expect(refusal(result).rule).toBe("policy/missing-citation");
    expect(refusal(result).instead.some((line) => line.startsWith("--cite run.txt:"))).toBe(false);
  });

  it("never resolves a citation into a binary file", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("capture.png", PNG);
    const result = await record(
      h,
      "ui-capture",
      "capture.png",
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "capture.png:1",
    );
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/missing-citation");
  });

  it("commits small text and keeps a large or binary file on the machine", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("reports/junit.txt", "ok 1\n".repeat(3600));
    h.put("coverage/coverage.json", `{"lines":"${"x".repeat(2_000_000)}"}`);
    h.put("capture.png", PNG);
    h.put(".bdk/.machine/evidence/trace.bin", PNG);
    const result = await record(
      h,
      "tests-scoped",
      "reports/junit.txt",
      "coverage/coverage.json",
      "capture.png",
      ".bdk/.machine/evidence/trace.bin",
      "--ticket",
      ticket,
      "--verdict",
      "fail",
    );
    expect(result.code, result.stdout).toBe(0);
    const out = result.json as Recorded;
    const id = out.evidence;
    expect(out.files.map((file) => [file.path, file.stored])).toEqual([
      [`${REL}/evidence/01-1-${id}-junit.txt`, "committed"],
      [`.bdk/.machine/evidence/01-1-${id}-coverage.json`, "machine"],
      [`.bdk/.machine/evidence/01-1-${id}-capture.png`, "machine"],
      [".bdk/.machine/evidence/trace.bin", "machine"],
    ]);
    expect(h.store.readBytes(`${ROOT}/.bdk/.machine/evidence/01-1-${id}-capture.png`)).toEqual(PNG);
    expect(h.store.list(`${DIR}/evidence`).sort()).toEqual(
      [`01-1-${id}-junit.txt`, `01-1-${id}.md`].sort(),
    );
  });

  it("keeps every file on the machine when max-committed-bytes is 0", async () => {
    const h = await started();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "policy:\n  evidence:\n    max-committed-bytes: 0\n",
    );
    const ticket = await ticketOf(h);
    h.put("lint.txt", "clean\n");
    const result = await record(h, "lint", "lint.txt", "--ticket", ticket, "--verdict", "fail");
    expect(result.code, result.stdout).toBe(0);
    expect((result.json as Recorded).files[0]?.stored).toBe("machine");
  });

  it("records a project kind like a built-in one", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    h.put("snap.json", "{}");
    const result = await record(
      h,
      "contract-snapshot",
      "snap.json",
      "--ticket",
      ticket,
      "--verdict",
      "not-run",
    );
    expect(result.code, result.stdout).toBe(0);
    const out = result.json as Recorded;
    expect(manifest(h, out.path)).toMatchObject({ kind: "contract-snapshot", verdict: "not-run" });
  });

  it("returns the earlier manifest for the same call on an unchanged tree", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    const first = await recordedPass(h, ticket);
    const second = await recordedPass(h, ticket);
    expect(second).toEqual({ ...first, deduplicated: true });
    expect(manifests(h)).toEqual([`01-1-${first.evidence}.md`]);

    h.put("src/01-2.ts", "// changed\n");
    const third = await recordedPass(h, ticket);
    expect(third.deduplicated).toBe(false);
    expect(third.evidence).not.toBe(first.evidence);
    expect(manifests(h)).toHaveLength(2);
  });
});
