// `bdk log ingest` (`kernel-cli/log`; T23-D25, D26): a role's report with its
// envelope as frontmatter, validated whole and stored at the dispatch
// package's `report` path; no ledger entry is written.
import { describe, expect, it } from "vitest";

import { readDocument, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { logRegistrations } from "../index.ts";
import { logIngestOutput } from "../schema/outputs.ts";
import {
  AT,
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  logDeps,
  repository,
  ROOT,
  runBdk,
  writePackage,
  ingestArgv,
} from "./support.ts";

const TICKET = "A-9c2d4f6h";
const OTHER = "A-7f3k9m2q";
const HASH = `sha256:${"a".repeat(64)}`;

const reportPath = (role: string) => `.bdk/changes/${CHANGE}/reports/02-${role}-${TICKET}.md`;

function harness(options: { role?: string; dispatch?: boolean; closed?: boolean } = {}) {
  const role = options.role ?? "verifier";
  const store = repository();
  const git = fakeGit();
  const deps = logDeps(store, git);
  writeDocument(store, `${DIR}/attempts/verifier-02-${TICKET}.md`, {
    data: {
      schema: 1,
      ticket: TICKET,
      loop: "verifier",
      target: "02",
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
      ...(options.closed === true
        ? { "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" }
        : {}),
    },
    body: "",
  });
  if (options.dispatch !== false) writePackage(store, TICKET, role, "02");
  const run = (argv: readonly string[], stdin?: string) =>
    runBdk(logRegistrations(deps), store, git, argv, stdin);
  return {
    store,
    role,
    run,
    ingest: (text: string) => run(ingestArgv(store, TICKET, text, "--json")),
    /** An entry written under `ticket` through `log add`; answers its id. */
    entry: async (summary: string, ticket = TICKET) => {
      const added = await run(
        ["log", "add", "observation", summary, "--ref", "02", "--ticket", ticket, "--json"],
        undefined,
      );
      expect(added.code, added.stdout).toBe(0);
      return (added.json as { entry: { id: string } }).entry.id;
    },
  };
}

function manifest(store: Store, id: string, ticket: string): void {
  writeDocument(store, `${DIR}/evidence/02-${id}.md`, {
    data: {
      schema: 1,
      id,
      kind: "tests-scoped",
      ticket,
      target: "02",
      at: "2026-09-25T10:20:00.000Z",
      author: AUTHOR,
      source: "kernel",
      "tree-hash": HASH,
      tree: [],
      files: [
        {
          path: `.bdk/changes/${CHANGE}/evidence/02-${id}-junit.xml`,
          hash: HASH,
          stored: "committed",
        },
      ],
    },
    body: "",
  });
}

/** A report whose frontmatter holds `lines` as given. */
function report(lines: readonly string[], body = "# Report\n\nAll good.\n"): string {
  return `---\n${lines.map((line) => `${line}\n`).join("")}---\n${body}`;
}

const ENVELOPE = ["status: done", "files: []", "entries: []", "evidence: []"];

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string };
}

function reports(store: Store): string[] {
  return store.list(`${DIR}/reports`);
}

describe("log ingest", () => {
  it("stores the report with the stamped fields and answers the example's shape", async () => {
    const h = harness();
    const id = await h.entry("naming drifts between parts");
    const result = await h.ingest(
      report(["status: done-with-concerns", "files: []", `entries: [${id}]`, "evidence: []"]),
    );
    expect(result.code, result.stdout).toBe(0);
    expect(logIngestOutput.parse(result.json)).toStrictEqual({
      ticket: TICKET,
      role: "verifier",
      path: reportPath("verifier"),
      status: "done-with-concerns",
      entries: [id],
      replaced: false,
    });
    const stored = readDocument(h.store, `${ROOT}/${reportPath("verifier")}`);
    expect(stored).toMatchObject({
      kind: "report",
      data: {
        schema: 1,
        ticket: TICKET,
        role: "verifier",
        at: AT,
        status: "done-with-concerns",
        entries: [id],
      },
      body: "# Report\n\nAll good.\n",
    });
  });

  it("writes the envelope in flow style, within 15 lines [NFR-SIZES]", async () => {
    const h = harness();
    const files = Array.from({ length: 12 }, (_, at) => `src/auth/file-${String(at)}.ts`);
    await h.ingest(
      report(["status: done", `files: [${files.join(", ")}]`, "entries: []", "evidence: []"]),
    );
    const text = h.store.read(`${ROOT}/${reportPath("verifier")}`) ?? "";
    const frontmatter = text.split("---\n")[1] ?? "";
    expect(frontmatter.split("\n").length).toBeLessThanOrEqual(15);
    expect(frontmatter).toContain(`files: [${files.join(", ")}]`);
  });

  it("writes no ledger entry", async () => {
    const h = harness();
    await h.ingest(report(ENVELOPE));
    expect(h.store.list(`${DIR}/log`)).toStrictEqual([]);
  });

  it("stores an implementer's report and replaces it on a second call", async () => {
    const h = harness({ role: "implementer" });
    const first = await h.ingest(
      report(["status: done", "files: [src/a.ts]", "entries: []", "evidence: []"]),
    );
    expect(first.code, first.stdout).toBe(0);
    expect(logIngestOutput.parse(first.json)).toMatchObject({
      role: "implementer",
      replaced: false,
    });
    const second = await h.ingest(report(ENVELOPE, "# Second\n"));
    expect(logIngestOutput.parse(second.json).replaced).toBe(true);
    const stored = readDocument(h.store, `${ROOT}/${reportPath("implementer")}`);
    expect(stored).toMatchObject({
      data: { ticket: TICKET, role: "implementer", files: [] },
      body: "# Second\n",
    });
  });

  it("keeps each role's report of a ticket: a runner after the implementer", async () => {
    const h = harness({ role: "implementer" });
    await h.ingest(report(["status: done", "files: [src/a.ts]", "entries: []", "evidence: []"]));
    const implementer = h.store.read(`${ROOT}/${reportPath("implementer")}`);
    writePackage(h.store, TICKET, "runner", "02");
    const runner = await h.ingest(report(ENVELOPE, "# Checks\n"));
    expect(logIngestOutput.parse(runner.json)).toMatchObject({
      role: "runner",
      path: reportPath("runner"),
      replaced: false,
    });
    expect(readDocument(h.store, `${ROOT}/${reportPath("runner")}`)).toMatchObject({
      data: { role: "runner" },
    });
    expect(h.store.read(`${ROOT}/${reportPath("implementer")}`)).toBe(implementer);
  });

  it("accepts a blocked report with its reason", async () => {
    const h = harness();
    const result = await h.ingest(
      report([
        "status: blocked",
        "files: []",
        "entries: []",
        "evidence: []",
        "reason: the plan part is missing",
      ]),
    );
    expect(result.code, result.stdout).toBe(0);
  });

  it.each([
    ["done", '""'],
    ["done", "null"],
    ["done-with-concerns", '""'],
    ["done-with-concerns", "null"],
  ])("reads reason: %2$s on %1$s as absent", async (status, value) => {
    const h = harness();
    const result = await h.ingest(
      report([`status: ${status}`, "files: []", "entries: []", "evidence: []", `reason: ${value}`]),
    );
    expect(result.code, result.stdout).toBe(0);
    const stored = readDocument(h.store, `${ROOT}/${reportPath("verifier")}`);
    expect(stored).toMatchObject({ data: { status } });
    expect(stored).not.toMatchObject({ data: { reason: expect.anything() as unknown } });
  });

  it.each(["blocked", "needs-context"])("still refuses an empty reason on %s", async (status) => {
    const h = harness();
    const result = await h.ingest(
      report([`status: ${status}`, "files: []", "entries: []", "evidence: []", 'reason: ""']),
    );
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-envelope" });
    expect(refusal(result).why).toMatch(/reason/);
    expect(reports(h.store)).toStrictEqual([]);
  });

  it("accepts evidence recorded under the ticket", async () => {
    const h = harness();
    manifest(h.store, "E-5hq0m2vd", TICKET);
    const result = await h.ingest(
      report(["status: done", "files: []", "entries: []", "evidence: [E-5hq0m2vd]"]),
    );
    expect(result.code, result.stdout).toBe(0);
  });

  it("applies no cap: six observations are stored", async () => {
    const h = harness();
    const ids: string[] = [];
    for (const n of [1, 2, 3, 4, 5, 6]) ids.push(await h.entry(`observation number ${String(n)}`));
    const result = await h.ingest(
      report([
        "status: done-with-concerns",
        "files: []",
        `entries: [${ids.join(", ")}]`,
        "evidence: []",
      ]),
    );
    expect(result.code, result.stdout).toBe(0);
  });

  it("prints the stored path in text mode", async () => {
    const h = harness();
    const result = await h.run(ingestArgv(h.store, TICKET, report(ENVELOPE)));
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      `report stored for ${TICKET} (verifier, done)\n${reportPath("verifier")}\n`,
    );
  });
});

describe("log ingest refusals", () => {
  it.each([
    ["no frontmatter", "# Report only\n", /no frontmatter/],
    [
      "an unknown field",
      report([...ENVELOPE, "verdict: pass"]),
      /line 6: verdict is not an envelope field/,
    ],
    [
      "a disposition",
      report([...ENVELOPE, "disposition: defer"]),
      /line 6: disposition is not an envelope field/,
    ],
    ["a wrong type", report(["status: done", "status2: x"]), /line 3: status2/],
    [
      "a missing field",
      report(["status: done", "files: []", "entries: []"]),
      /evidence is missing/,
    ],
    ["unparsable YAML", report(["status: [done"]), /line \d+:/],
  ])("refuses %s with input/invalid-envelope and writes nothing", async (_, stdin, why) => {
    const h = harness();
    const result = await h.ingest(stdin);
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-envelope" });
    expect(refusal(result).why).toMatch(why);
    expect(reports(h.store)).toStrictEqual([]);
  });

  it("names status and line 3 for a wrong status value", async () => {
    const h = harness();
    const result = await h.ingest(
      report(["files: []", "status: finished", "entries: []", "evidence: []"]),
    );
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-envelope" });
    expect(refusal(result).why).toMatch(/^line 3: status /);
  });

  it("names reason when a blocked report has none", async () => {
    const h = harness();
    const result = await h.ingest(
      report(["status: blocked", "files: []", "entries: []", "evidence: []"]),
    );
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-envelope" });
    expect(refusal(result).why).toMatch(/reason/);
    expect(reports(h.store)).toStrictEqual([]);
  });

  it.each(["schema: 1", `ticket: ${TICKET}`, "role: verifier", `at: ${AT}`])(
    "refuses a stamped field (%s) with input/forbidden-field",
    async (line) => {
      const h = harness();
      const result = await h.ingest(report([line, ...ENVELOPE]));
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/forbidden-field" });
      expect(refusal(result).why).toMatch(/^line 2: /);
      expect(reports(h.store)).toStrictEqual([]);
    },
  );

  it.each([
    ["closed", { closed: true }],
    ["without a package", { dispatch: false }],
  ])("refuses a ticket %s with policy/no-open-ticket", async (_, options) => {
    const h = harness(options);
    const result = await h.ingest(report(ENVELOPE));
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/no-open-ticket" });
  });

  it("names the entries not written under the ticket with policy/entries-missing", async () => {
    const h = harness();
    const own = await h.entry("written under the ticket");
    const result = await h.ingest(
      report(["status: done", "files: []", `entries: [${own}, L-zzzzzzzz]`, "evidence: []"]),
    );
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/entries-missing" });
    expect(refusal(result).why).toContain("L-zzzzzzzz");
    expect(refusal(result).why).not.toContain(own);
    expect(reports(h.store)).toStrictEqual([]);
  });

  it("names evidence recorded under another ticket with policy/entries-missing", async () => {
    const h = harness();
    manifest(h.store, "E-5hq0m2vd", OTHER);
    const result = await h.ingest(
      report(["status: done", "files: []", "entries: []", "evidence: [E-5hq0m2vd, E-00000000]"]),
    );
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/entries-missing" });
    expect(refusal(result).why).toContain("E-5hq0m2vd, E-00000000");
  });

  it("refuses an empty stdin with input/missing-argument", async () => {
    const h = harness();
    const result = await h.ingest("");
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/missing-argument" });
  });
});

// `log add report` (v3-t41-design D10): the entry a verdict node reads names
// the report `log ingest` stored under the ticket.
describe("log add report", () => {
  const addReport = (h: ReturnType<typeof harness>, ...refs: string[]) =>
    h.run(
      [
        "log",
        "add",
        "report",
        "verdict stored",
        ...refs.flatMap((ref) => ["--ref", ref]),
        "--ticket",
        TICKET,
        "--json",
      ],
      undefined,
    );

  it("names the stored report of the ticket and the ticket's target", async () => {
    const h = harness();
    await h.ingest(report(ENVELOPE));
    const result = await addReport(h, "design.md");
    expect(result.code, result.stdout).toBe(0);
    expect(result.json).toMatchObject({
      entry: {
        type: "report",
        source: "agent:verifier",
        ticket: TICKET,
        refs: ["design.md", "02"],
        report: `reports/02-verifier-${TICKET}.md`,
      },
    });
  });

  it("keeps the target once when a ref names it", async () => {
    const h = harness();
    await h.ingest(report(ENVELOPE));
    const result = await addReport(h, "02");
    expect(result.json).toMatchObject({ entry: { refs: ["02"] } });
  });

  it("writes a new entry for each round, never a duplicate", async () => {
    const h = harness();
    await h.ingest(report(ENVELOPE));
    const first = await addReport(h, "02");
    const second = await addReport(h, "02");
    expect(second.json).toMatchObject({ deduplicated: false });
    expect((second.json as { entry: { id: string } }).entry.id).not.toBe(
      (first.json as { entry: { id: string } }).entry.id,
    );
  });

  it("refuses before log ingest stored the report, writing nothing", async () => {
    const h = harness();
    const result = await addReport(h, "02");
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/not-found" });
    expect(refusal(result).why).toContain(reportPath("verifier"));
    expect(h.store.list(`${DIR}/log`)).toStrictEqual([]);
  });

  it("refuses without --ticket: the report comes from the ticket's package", async () => {
    const h = harness();
    const result = await h.run(
      ["log", "add", "report", "verdict stored", "--ref", "02", "--json"],
      undefined,
    );
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/missing-argument" });
  });

  it("refuses a closed ticket with policy/no-open-ticket", async () => {
    const h = harness({ closed: true });
    const result = await addReport(h, "02");
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/no-open-ticket" });
  });
});

describe("a blocker raised under a ticket", () => {
  const addBlocker = (h: ReturnType<typeof harness>, ref: string) =>
    h.run(
      [
        "log",
        "add",
        "blocker",
        "the design names a class the code lacks",
        "--ref",
        ref,
        "--category",
        "false-code-claim",
        "--ticket",
        TICKET,
        "--json",
      ],
      undefined,
    );

  it("names the ticket's target, so the verdict node of the target sees it", async () => {
    const h = harness();
    const result = await addBlocker(h, "design.md");
    expect(result.code, result.stdout).toBe(0);
    expect(result.json).toMatchObject({
      entry: { type: "blocker", refs: ["design.md", "02"], category: "false-code-claim" },
    });
  });

  it("keeps the target once when a ref names it", async () => {
    const h = harness();
    const result = await addBlocker(h, "02");
    expect(result.json).toMatchObject({ entry: { refs: ["02"] } });
  });

  it("lists with its category", async () => {
    const h = harness();
    await addBlocker(h, "design.md");
    const listed = await h.run(["log", "list", "--type", "blocker", "--json"], undefined);
    expect(listed.json).toMatchObject({
      items: [{ type: "blocker", category: "false-code-claim" }],
    });
  });
});
