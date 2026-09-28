// `bdk log ingest` (`kernel-cli/log`; T22 design D-13): one `bdk-entries`
// block from a read-only role's report, validated whole before any write.
import { describe, expect, it } from "vitest";

import { readDocument, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { logRegistrations } from "../index.ts";
import { logIngestOutput } from "../schema/outputs.ts";
import { AUTHOR, CHANGE, DIR, fakeGit, logDeps, repository, ROOT, runBdk } from "./support.ts";

const TICKET = "A-9c2d4f6h";
const REPORT = `.bdk/changes/${CHANGE}/reports/plan-verify-plan-verifier-${TICKET}.md`;

function harness(options: { dispatch?: boolean; closed?: boolean } = {}) {
  const store = repository();
  const git = fakeGit();
  const deps = logDeps(store, git);
  writeDocument(store, `${DIR}/attempts/verifier-plan-verify-${TICKET}.md`, {
    data: {
      schema: 1,
      ticket: TICKET,
      loop: "verifier",
      target: "plan-verify",
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00Z",
      author: AUTHOR,
      ...(options.closed === true ? { "closed-at": "2026-09-25T10:30:00Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  if (options.dispatch !== false) {
    writeDocument(store, `${DIR}/dispatch/plan-verify-plan-verifier-${TICKET}.md`, {
      data: {
        schema: 1,
        ticket: TICKET,
        target: "plan-verify",
        role: "plan-verifier",
        attempt: 1,
        of: 2,
        scope: "full",
        at: "2026-09-25T10:00:01Z",
        "kernel-version": "3.0.0-dev",
        "template-hash": `sha256:${"a".repeat(64)}`,
        report: REPORT,
      },
      body: "",
    });
  }
  return {
    store,
    run: (argv: readonly string[], stdin?: string) =>
      runBdk(logRegistrations(deps), store, git, ["log", "ingest", ...argv], stdin),
  };
}

function block(yaml: string): string {
  return `\`\`\`bdk-entries\n${yaml}\`\`\`\n`;
}

const TWO = block(
  "- type: blocker\n" +
    "  summary: plan claims verifyToken exists; it does not\n" +
    "  refs: [plan/parts/02-login.md, src/auth/token.ts]\n" +
    "- type: finding\n" +
    "  summary: part 02 has no test for expiry\n" +
    "  refs: [plan/parts/02-login.md]\n" +
    "  severity: high\n" +
    "  category: test-coverage\n",
);

function report(before: number, body: string): string {
  return `${Array.from({ length: before }, (_, at) => `line ${String(at + 1)}`).join("\n")}\n${body}\nThe end.\n`;
}

function logFiles(store: Store): string[] {
  return store.list(`${DIR}/log`);
}

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string };
}

describe("log ingest", () => {
  it("writes every item of a bare block under the ticket with the role's provenance", async () => {
    const h = harness();
    const result = await h.run(["--ticket", TICKET, "--json"], TWO);
    expect(result.code, result.stdout).toBe(0);
    const out = logIngestOutput.parse(result.json);
    expect(out).toMatchObject({
      ticket: TICKET,
      downgraded: [],
      entries: [
        { type: "blocker", source: "agent:plan-verifier", status: "proposed" },
        { type: "finding", severity: "high", category: "test-coverage" },
      ],
    });
    const written = logFiles(h.store).map((name) => readDocument(h.store, `${DIR}/log/${name}`));
    expect(
      written.map((doc) => (doc && "data" in doc ? doc.data.ticket : undefined)),
    ).toStrictEqual([TICKET, TICKET]);
    expect(h.store.read(`${ROOT}/${REPORT}`)).toBeUndefined();
  });

  it("stores a whole report from stdin at the package's report path", async () => {
    const h = harness();
    const text = report(3, TWO);
    expect((await h.run(["--ticket", TICKET, "--json"], text)).code).toBe(0);
    expect(h.store.read(`${ROOT}/${REPORT}`)).toBe(text);
  });

  it("reads --file and does not copy it", async () => {
    const h = harness();
    h.store.write(`${ROOT}/notes/report.md`, report(2, TWO));
    const result = await h.run(["--ticket", TICKET, "--file", "notes/report.md", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(h.store.read(`${ROOT}/${REPORT}`)).toBeUndefined();
  });

  it("deduplicates an item the ticket already wrote", async () => {
    const h = harness();
    await h.run(["--ticket", TICKET, "--json"], TWO);
    const again = await h.run(["--ticket", TICKET, "--json"], TWO);
    expect(again.code).toBe(0);
    expect(logFiles(h.store)).toHaveLength(2);
  });

  it.each([
    ["no block", "just prose\n"],
    ["two blocks", `${TWO}\n${TWO}`],
    ["a mapping, not a sequence", block("type: finding\n")],
    ["a sequence of scalars", block("- finding\n")],
    ["YAML that does not parse", block("- type: [finding\n")],
  ])("refuses %s with input/invalid-block and writes nothing", async (_, text) => {
    const h = harness();
    const result = await h.run(["--ticket", TICKET, "--json"], text);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/invalid-block");
    expect(logFiles(h.store)).toStrictEqual([]);
  });

  it.each(["id", "at", "author", "source", "ticket", "fingerprint"])(
    "refuses the kernel-stamped field %s naming its line",
    async (field) => {
      const h = harness();
      const text = block(`- type: finding\n  summary: s\n  refs: [a.ts]\n  ${field}: x\n`);
      const result = await h.run(["--ticket", TICKET, "--json"], text);
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/forbidden-field" });
      expect(refusal(result).why).toBe(`item 1, line 5: ${field} is stamped by the kernel`);
      expect(logFiles(h.store)).toStrictEqual([]);
    },
  );

  it("a wrong type names the item, the field and the line of the whole report", async () => {
    const h = harness();
    const items =
      "- type: finding\n  summary: first\n  refs: [a.ts]\n  severity: low\n" +
      "- type: bug\n  summary: second\n  refs: [a.ts]\n" +
      "- type: finding\n  summary: third\n  refs: [a.ts]\n";
    // The fence on line 40 (`kernel-cli/log`, wrong type names the line): item 2 on line 45.
    const result = await h.run(["--ticket", TICKET, "--json"], report(39, block(items)));
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-block" });
    expect(refusal(result).why).toMatch(/^item 2, line 45: type "bug" /);
    expect(logFiles(h.store)).toStrictEqual([]);
    expect(h.store.read(`${ROOT}/${REPORT}`)).toBeUndefined();
  });

  it("ignores a bdk-entries fence quoted inside another fenced block", async () => {
    const h = harness();
    const quoted = `\`\`\`\`markdown\n${block("- type: bug\n")}\`\`\`\`\n`;
    const result = await h.run(["--ticket", TICKET, "--json"], `${quoted}\n${TWO}`);
    expect(result.code, result.stdout).toBe(0);
    expect(logFiles(h.store)).toHaveLength(2);
  });

  it("refuses a bdk-entries fence that never closes", async () => {
    const result = await harness().run(
      ["--ticket", TICKET, "--json"],
      "```bdk-entries\n- type: x\n",
    );
    expect(refusal(result)).toMatchObject({
      rule: "input/invalid-block",
      why: "line 1: the bdk-entries fence is never closed",
    });
  });

  it("writes an item repeated inside the block once", async () => {
    const h = harness();
    const item = "- type: risk\n  summary: token clock skew\n  refs: [src/auth/token.ts]\n";
    const out = logIngestOutput.parse(
      (await h.run(["--ticket", TICKET, "--json"], block(item + item))).json,
    );
    expect(out.entries).toHaveLength(2);
    expect(out.entries[0]?.id).toBe(out.entries[1]?.id);
    expect(logFiles(h.store)).toHaveLength(1);
  });

  it("refuses a field of another type naming it", async () => {
    const result = await harness().run(
      ["--ticket", TICKET, "--json"],
      block("- type: blocker\n  summary: s\n  refs: [a.ts]\n  severity: high\n"),
    );
    expect(refusal(result)).toMatchObject({
      rule: "input/invalid-block",
      why: "item 1, line 5: severity is not a field of a blocker",
    });
  });

  it.each([
    ["type: transition", "- type: transition\n  summary: s\n  refs: [a.ts]\n", "type"],
    ["an empty refs list", "- type: finding\n  summary: s\n  refs: []\n", "refs"],
    [
      "a summary over 120 characters",
      `- type: finding\n  summary: ${"x".repeat(121)}\n  refs: [a.ts]\n`,
      "summary",
    ],
    [
      "status superseded",
      "- type: finding\n  summary: s\n  refs: [a.ts]\n  status: superseded\n",
      "status",
    ],
    [
      "an unknown field",
      "- type: finding\n  summary: s\n  refs: [a.ts]\n  colour: red\n",
      "colour",
    ],
    [
      "supersedes naming no entry",
      "- type: finding\n  summary: s\n  refs: [a.ts]\n  supersedes: L-nothing0\n",
      "supersedes",
    ],
  ])("refuses %s with input/invalid-block naming the field", async (_, items, field) => {
    const h = harness();
    const result = await h.run(["--ticket", TICKET, "--json"], block(items));
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-block" });
    expect(refusal(result).why).toMatch(new RegExp(`^item 1, line \\d+: ${field} `));
    expect(logFiles(h.store)).toStrictEqual([]);
  });

  it("refuses a closed ticket and a ticket without a dispatch package", async () => {
    for (const options of [{ closed: true }, { dispatch: false }]) {
      const h = harness(options);
      const result = await h.run(["--ticket", TICKET, "--json"], TWO);
      expect(result.code).toBe(2);
      expect(refusal(result).rule).toBe("policy/no-open-ticket");
      expect(logFiles(h.store)).toStrictEqual([]);
    }
  });

  it("needs --ticket", async () => {
    const result = await harness().run(["--json"], TWO);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/missing-argument");
  });

  it("text output lists the entries", async () => {
    const result = await harness().run(["--ticket", TICKET], TWO);
    expect(result.stdout).toMatch(/^2 entries ingested under A-9c2d4f6h\n/);
  });
});
