// Review groups of one `review-fix` ticket (`kernel-cli/dispatch`, bdk
// dispatch build; `kernel-cli`, Ticket references; T42-A1, D8, D9): one
// package, report and rule selection per `--group`, the `Review` and `Risks`
// sections, the gate runner's full checks, and the group reference on
// `dispatch show` and `rules show`.
import { describe, expect, it } from "vitest";

import { writeEntry } from "../../graph/tests/support.ts";
import { CHANGE, ROOT } from "../../log/tests/support.ts";
import { reviewGroups } from "../../review/domain/groups.ts";
import { readAttempts, readDocument } from "../../shared/store/index.ts";
import { dispatchBuildOutput, dispatchShowOutput } from "../schema/outputs.ts";
import { build, dispatchHarness, DIR, ticket } from "./support.ts";
import type { DispatchHarness } from "./support.ts";
import { ruleFile } from "../../../tests/support/rule-file.ts";

const ROUND = "A-r1v2w3x4";
const RANGE = "H0..H1";

/** The harness with an open `review-fix` round ticket on the Change. */
function round(): DispatchHarness {
  const h = dispatchHarness();
  ticket(h.store, { target: CHANGE, loop: "review-fix", id: ROUND });
  return h;
}

function grouped(h: DispatchHarness, role: string, group: string, ...flags: string[]) {
  return build(h, CHANGE, role, ROUND, "--group", group, ...flags);
}

async function groupBuilt(h: DispatchHarness, role: string, group: string, ...flags: string[]) {
  const result = await grouped(h, role, group, ...flags);
  expect(result.code, result.stdout).toBe(0);
  const report = dispatchBuildOutput.parse(result.json);
  const text = h.store.read(`${ROOT}/${report.path}`) ?? "";
  const document = readDocument(h.store, `${ROOT}/${report.path}`);
  const data = document !== undefined && "data" in document ? document.data : {};
  return { report, text, data };
}

function rule(result: { json: unknown }): string {
  return (result.json as { rule: string }).rule;
}

/** The `## <name>` section of a package body, up to the next section. */
function section(text: string, name: string): string {
  const start = text.indexOf(`\n## ${name}\n`);
  expect(start, `no ${name} section`).toBeGreaterThan(-1);
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

/** Changed files of a large range: 14 modules of 15 files, with paths of a real project's length. */
function largeRange(): string[] {
  return Array.from({ length: 14 }, (_, m) =>
    Array.from(
      { length: 15 },
      (_, f) => `packages/feature-${String(m)}/src/components/widgets/handler-${String(f)}.ts`,
    ),
  ).flat();
}

const TRIAGE_SENTENCE = "Only an entry in one of these categories can be triaged `blocker`.";

describe("the P8 lists of the reviewing roles (#158)", () => {
  it.each(["reviewer", "integration-reviewer", "judge"])(
    "gives a %s package the blocking categories and not-a-fail with the triage sentence",
    async (role) => {
      const h = round();
      const group = role === "reviewer" ? "m1" : role === "judge" ? "judge" : "integration";
      const files = role === "reviewer" ? ["--file", "src/a.ts"] : [];
      const { text } = await groupBuilt(h, role, group, "--range", RANGE, ...files);
      const categories = section(text, "Blocking categories (P8)");
      expect(categories).toContain(TRIAGE_SENTENCE);
      expect(categories).not.toContain("is stored as an observation");
      expect(categories).toContain("- `security`:");
      expect(section(text, "Not a fail")).toContain("- `verification-defect`:");
    },
  );
});

describe("dispatch build --group", () => {
  it("builds the package of every group `bdk review plan` makes at the default review.group.max-files", async () => {
    const h = round();
    const changed = largeRange();
    const groups = reviewGroups({
      changed,
      binary: [],
      parts: [],
      maxFiles: 30,
      moduleOf: (path) => path.split("/").slice(0, 2).join("/"),
    });
    expect(groups.length).toBeGreaterThan(2);
    for (const group of groups) {
      const role = group.kind === "integration" ? "integration-reviewer" : "reviewer";
      // The integration reviewer takes no file list (#158).
      const files = role === "reviewer" ? group.files.flatMap((file) => ["--file", file]) : [];
      const result = await grouped(h, role, group.id, "--range", RANGE, ...files);
      expect(result.code, `${group.id}: ${result.stdout}`).toBe(0);
    }
  });

  it("refuses a group package above 160 KiB and names review.group.max-files", async () => {
    const h = round();
    const files = Array.from({ length: 4000 }, (_, i) => `src/area-${String(i)}/file.ts`);
    const result = await grouped(
      h,
      "reviewer",
      "p01",
      "--range",
      RANGE,
      ...files.flatMap((file) => ["--file", file]),
    );
    expect(result.code, result.stdout).toBe(2);
    expect(rule(result)).toBe("policy/package-too-large");
    expect((result.json as { why: string }).why).toMatch(/above 163840; the largest section is /);
    expect(JSON.stringify(result.json)).toContain("review.group.max-files");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it("writes the group's package with group, files and report, and leaves the active package", async () => {
    const h = round();
    const { report, data } = await groupBuilt(
      h,
      "reviewer",
      "p01",
      "--part",
      "02",
      "--range",
      RANGE,
      "--file",
      "src/auth/verify.ts",
    );
    const name = `${CHANGE}-reviewer-${ROUND}-p01.md`;
    expect(report.path).toBe(`.bdk/changes/${CHANGE}/dispatch/${name}`);
    expect(report).toMatchObject({ group: "p01", files: ["src/auth/verify.ts"] });
    expect(report.report).toBe(`.bdk/changes/${CHANGE}/reports/${CHANGE}-reviewer-${ROUND}-p01.md`);
    expect(data).toMatchObject({
      group: "p01",
      files: ["src/auth/verify.ts"],
      report: report.report,
    });
    const record = readAttempts(h.store, DIR).find((file) => file.data.ticket === ROUND);
    expect(record?.data.package).toBeUndefined();
  });

  it("keeps two groups side by side and shows each by its reference", async () => {
    const h = round();
    await groupBuilt(h, "reviewer", "p01", "--range", RANGE, "--file", "src/auth/store.ts");
    const second = await groupBuilt(
      h,
      "reviewer",
      "p02",
      "--range",
      RANGE,
      "--file",
      "src/mail/send.ts",
    );
    expect(h.store.list(`${DIR}/dispatch`).sort()).toStrictEqual([
      `${CHANGE}-reviewer-${ROUND}-p01.md`,
      `${CHANGE}-reviewer-${ROUND}-p02.md`,
    ]);
    const shown = await h.run(["dispatch", "show", `${ROUND}@p02`, "--json"]);
    expect(shown.code, shown.stdout).toBe(0);
    expect(dispatchShowOutput.parse(shown.json)).toMatchObject({
      path: second.report.path,
      content: second.text,
    });
  });

  it("replaces an earlier package of the same group whatever its role", async () => {
    const h = round();
    await groupBuilt(h, "reviewer", "p01", "--range", RANGE);
    await groupBuilt(h, "scout", "p01");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([`${CHANGE}-scout-${ROUND}-p01.md`]);
  });

  it.each([
    ["the reserved group merge", ["reviewer", "merge", "--range", RANGE]],
    ["a group that is not kebab-case", ["reviewer", "P_01", "--range", RANGE]],
    ["a group above 32 characters", ["reviewer", "g".repeat(33), "--range", RANGE]],
    ["a reviewer without --range", ["reviewer", "p01"]],
    ["an integration reviewer without --range", ["integration-reviewer", "integration"]],
    ["a malformed range", ["reviewer", "p01", "--range", "H0...H1"]],
    ["a part the Change does not hold", ["reviewer", "p01", "--range", RANGE, "--part", "07"]],
    [
      "a focus above 500 characters",
      ["reviewer", "p01", "--range", RANGE, "--focus", "x".repeat(501)],
    ],
    ["a role that is not grouped", ["implementer", "p01", "--range", RANGE]],
  ])("refuses %s with input/invalid-argument", async (_, [role = "", group = "", ...flags]) => {
    const h = round();
    const result = await grouped(h, role, group, ...flags);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it.each([
    ["--file", "src/a.ts"],
    ["--part", "02"],
    ["--range", RANGE],
    ["--focus", "auth"],
  ])("refuses %s without --group with input/invalid-argument", async (flag, value) => {
    const result = await build(round(), CHANGE, "reviewer", ROUND, flag, value);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("refuses a group on a ticket of another loop with input/invalid-argument", async () => {
    const result = await build(
      dispatchHarness(),
      "02",
      "reviewer",
      "A-7f3k9m2q",
      "--group",
      "p01",
      "--range",
      RANGE,
    );
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("selects the group's rules by its files", async () => {
    const h = round();
    h.store.write(`${ROOT}/.bdk/rules/API-1.md`, ruleFile("API-1", { paths: ["src/api/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["web/**"] }));
    const { data } = await groupBuilt(
      h,
      "reviewer",
      "p01",
      "--range",
      RANGE,
      "--file",
      "src/api/login.ts",
    );
    expect(data.rules).toContain("API-1");
    expect(data.rules).not.toContain("UI-1");
  });

  it("selects by the --part tasks' files without --file", async () => {
    const h = round();
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, ruleFile("AUTH-1", { paths: ["src/auth/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["web/**"] }));
    const { data } = await groupBuilt(h, "reviewer", "p02", "--range", RANGE, "--part", "02");
    expect(data.rules).toContain("AUTH-1");
    expect(data.rules).not.toContain("UI-1");
  });

  it("keeps a 30-file group well under the package limit", async () => {
    const files = Array.from({ length: 30 }, (_, i) => [
      "--file",
      `src/module-${String(i)}/handler-file.ts`,
    ]).flat();
    const { report } = await groupBuilt(
      round(),
      "reviewer",
      "p01",
      "--range",
      RANGE,
      "--part",
      "02",
      ...files,
    );
    expect(report.bytes).toBeLessThan(163_840 / 4);
  });

  it("names range, files, the diff command, the part, the intent paths and the focus in its Review section", async () => {
    const h = round();
    h.store.write(`${DIR}/design.md`, "---\nschema: 1\ntitle: Login\n---\n\n# Design\n");
    const { text, report } = await groupBuilt(
      h,
      "reviewer",
      "p02",
      "--range",
      RANGE,
      "--part",
      "02",
      "--file",
      "src/auth/verify.ts",
      "--file",
      "src/auth/store.ts",
      "--focus",
      "token expiry",
    );
    const review = section(text, "Review");
    expect(review).toContain("`p02`");
    expect(review).toContain(`\`${RANGE}\``);
    expect(review).toContain("- `src/auth/verify.ts`\n- `src/auth/store.ts`");
    expect(review).toContain(`\`git diff ${RANGE} -- src/auth/verify.ts src/auth/store.ts\``);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/plan/parts/02-part.md\``);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/change.md\``);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/design.md\``);
    expect(review).not.toContain("architecture.md");
    expect(review).toContain("token expiry");
    expect(section(text, "Return")).toContain(`--ticket ${ROUND}@p02`);
    expect(text).toContain(`bdk rules show --ticket ${ROUND}@p02`);
    expect(report.report).toContain("-p02.md");
  });

  it("gives an ungrouped package no Review section", async () => {
    const h = round();
    const result = await build(h, CHANGE, "reviewer", ROUND);
    expect(result.code, result.stdout).toBe(0);
    const text = h.store.read(`${ROOT}/${dispatchBuildOutput.parse(result.json).path}`) ?? "";
    expect(text).not.toContain("\n## Review\n");
  });
});

describe("the integration reviewer's package", () => {
  it("runs on integrator with the diff stat, the intent paths and the six default risks", async () => {
    const h = round();
    const { report, text } = await groupBuilt(
      h,
      "integration-reviewer",
      "integration",
      "--range",
      RANGE,
    );
    expect(report).toMatchObject({
      role: "integration-reviewer",
      adapter: "integrator",
      files: [],
    });
    const review = section(text, "Review");
    expect(review).toContain(`\`git diff --stat ${RANGE}\``);
    // No command that prints the whole diff of the range (#158).
    expect(text).not.toContain(`\`git diff ${RANGE}\``);
    expect(text).not.toContain(`git diff --name-only ${RANGE}`);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/change.md\``);
    const risks = section(text, "Risks");
    for (const id of [
      "auth",
      "migration",
      "secrets",
      "public-api",
      "dependencies",
      "configuration",
    ]) {
      expect(risks).toContain(`- \`${id}\`: `);
    }
  });

  it("lists the enabled risks only, a project risk included", async () => {
    const h = round();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "review:\n  risks:\n    - id: dependencies\n      enabled: false\n    - id: billing\n      instruction: Call out any change to how invoices are totalled.\n",
    );
    const { text } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    const risks = section(text, "Risks");
    expect(risks).not.toContain("`dependencies`");
    expect(risks).toContain("Call out any change to how invoices are totalled.");
    expect(text).toContain("## Role: integration-reviewer");
  });

  it("names the reviewer groups with their files and reports, an unstored report as not reviewed, and no gate", async () => {
    const h = round();
    await groupBuilt(h, "reviewer", "m1", "--range", RANGE, "--file", "src/a.ts");
    await groupBuilt(
      h,
      "reviewer",
      "m2",
      "--range",
      RANGE,
      "--file",
      "src/b.ts",
      "--file",
      "src/c.ts",
    );
    await groupBuilt(h, "runner", "gate");
    h.store.write(`${DIR}/reports/${CHANGE}-reviewer-${ROUND}-m1.md`, "---\nstatus: done\n---\n");
    const { text } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    const review = section(text, "Review");
    expect(review).toContain(
      `- \`m1\`: \`src/a.ts\`; report \`.bdk/changes/${CHANGE}/reports/${CHANGE}-reviewer-${ROUND}-m1.md\``,
    );
    expect(review).toContain("- `m2` (not reviewed: no report stored): `src/b.ts`, `src/c.ts`");
    expect(review).not.toContain("`gate`");
  });

  it("names the spec deltas with the Intent table format, or says there are none", async () => {
    const h = round();
    const without = section(
      (await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE)).text,
      "Review",
    );
    expect(without).toContain(
      "The Change holds no spec delta, so your report has no `## Intent` section.",
    );
    expect(without).not.toContain("| Capability |");
    h.store.write(`${DIR}/spec-delta/auth/login.md`, "# Delta\n");
    const withDelta = section(
      (await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE)).text,
      "Review",
    );
    expect(withDelta).toContain(`- \`.bdk/changes/${CHANGE}/spec-delta/auth/login.md\``);
    expect(withDelta).toContain("| Capability | Requirement | Scenario | Code | Test | State |");
  });

  it("names the binary files of the range as not reviewed as text, with no content of them", async () => {
    const h = round();
    h.git.numstat = "-\t-\tsnapshots/a.png\u00003\t1\tsrc/ui/button.ts\u0000";
    const { text } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    const review = section(text, "Review");
    expect(review).toContain("Not reviewed as text (binary): `snapshots/a.png`.");
    expect(text).not.toContain("src/ui/button.ts");
  });

  it("stays under the package limit after nine reviewer groups of 30 long paths", async () => {
    const h = round();
    const paths = largeRange();
    for (let at = 0; at < 9; at++) {
      const files = paths.slice(at * 30, at * 30 + 30).flatMap((file) => ["--file", file]);
      await groupBuilt(h, "reviewer", `m${String(at + 1)}`, "--range", RANGE, ...files);
    }
    const { report } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    expect(report.bytes).toBeLessThan(163_840);
  });

  it.each([
    ["--file", "src/a.ts"],
    ["--part", "02"],
  ])("refuses %s for the integration reviewer", async (flag, value) => {
    const h = round();
    const result = await grouped(
      h,
      "integration-reviewer",
      "integration",
      "--range",
      RANGE,
      flag,
      value,
    );
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("reads the review stage over the work tree files, as the reviewer does", async () => {
    const h = round();
    h.git.workTree.push("src/api/login.ts");
    const { data } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    const packs = new Set(
      (data.rules as string[]).filter((id) => id.startsWith("BDK-")).map((id) => id.split("-")[1]),
    );
    expect([...packs].sort()).toStrictEqual(["ARCH", "CQ", "DP", "SEC", "TQ"]);
  });

  it("has no Risks section in another role's package", async () => {
    const { text } = await groupBuilt(round(), "reviewer", "p01", "--range", RANGE);
    expect(text).not.toContain("\n## Risks\n");
  });
});

describe("the judge's package (#158)", () => {
  /** The round's entries and the Change's others, as `judge package lists the round's entries` sets them. */
  function seeded(h: DispatchHarness) {
    const at = (minute: number) => `2026-09-25T10:${String(minute).padStart(2, "0")}:00.000Z`;
    const live = { status: "proposed", source: "agent:reviewer" };
    const a1 = writeEntry(h.store, {
      ...live,
      type: "finding",
      at: at(1),
      ticket: ROUND,
      group: "m1",
      summary: "parse takes a null body",
      refs: ["src/a.ts#parse"],
    });
    const b2 = writeEntry(h.store, {
      ...live,
      type: "finding",
      at: at(2),
      ticket: ROUND,
      group: "integration",
      source: "agent:integration-reviewer",
      summary: "no test for link expired",
      refs: ["src/b.ts", "auth"],
    });
    const c3 = writeEntry(h.store, {
      ...live,
      type: "observation",
      at: at(3),
      source: "agent:verifier",
      summary: "dates built by hand",
      refs: ["src/c.ts"],
    });
    const d4 = writeEntry(h.store, {
      type: "finding",
      at: at(4),
      ticket: ROUND,
      status: "resolved",
      summary: "resolved one",
    });
    const e5 = writeEntry(h.store, {
      ...live,
      type: "observation",
      at: at(5),
      level: "nice-to-have",
      summary: "triaged before",
    });
    const f6 = writeEntry(h.store, { type: "decision", at: at(6), ticket: ROUND });
    return { a1, b2, c3, others: [d4, e5, f6] };
  }

  it("lists the round's entries, then the Change's untriaged ones, and stamps them as entries", async () => {
    const h = round();
    const { a1, b2, c3, others } = seeded(h);
    h.store.write(`${DIR}/reports/${CHANGE}-reviewer-${ROUND}-m1.md`, "---\nstatus: done\n---\n");
    h.store.write(
      `${DIR}/reports/${CHANGE}-integration-reviewer-${ROUND}-integration.md`,
      "---\nstatus: done\n---\n",
    );
    h.store.write(`${DIR}/spec-delta/auth/login.md`, "# Delta\n");
    const { report, text, data } = await groupBuilt(h, "judge", "judge", "--range", RANGE);
    expect(report).toMatchObject({ role: "judge", adapter: "judge", files: [] });
    expect(data.entries).toStrictEqual([a1, b2, c3]);
    const review = section(text, "Review");
    expect(review).toContain(
      "The reviewers and the integration reviewer of this round have finished.",
    );
    expect(review).toContain(
      `- \`${a1}\` finding: parse takes a null body. Refs: \`src/a.ts#parse\`. Written by agent:reviewer in group \`m1\`.`,
    );
    expect(review).toContain(
      `- \`${b2}\` finding: no test for link expired. Refs: \`src/b.ts\`, \`auth\`. Written by agent:integration-reviewer in group \`integration\`.`,
    );
    expect(review).toContain(
      `- \`${c3}\` observation: dates built by hand. Refs: \`src/c.ts\`. Written by agent:verifier.`,
    );
    expect(review.indexOf(a1)).toBeLessThan(review.indexOf(c3));
    for (const id of others) expect(text).not.toContain(id);
    expect(review).toContain(`Range: \`${RANGE}\`.`);
    expect(review).toContain("`bdk log show <id>`");
    expect(review).toContain(
      `- \`.bdk/changes/${CHANGE}/reports/${CHANGE}-reviewer-${ROUND}-m1.md\``,
    );
    expect(review).toContain(
      `- \`.bdk/changes/${CHANGE}/reports/${CHANGE}-integration-reviewer-${ROUND}-integration.md\``,
    );
    expect(review).toContain(`- \`.bdk/changes/${CHANGE}/spec-delta/auth/login.md\``);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/change.md\``);
    expect(section(text, "Blocking categories (P8)")).toContain(TRIAGE_SENTENCE);
    expect(section(text, "Not a fail")).toContain("- `verification-defect`:");
    // No entry body and no diff: the judge reads each body with `bdk log show`.
    expect(text).not.toContain("\n## Ledger entries\n");
    expect(text).not.toContain("git diff");
  });

  it("says so when the round has no entry to judge", async () => {
    const { text, data } = await groupBuilt(round(), "judge", "judge", "--range", RANGE);
    expect(data.entries).toStrictEqual([]);
    expect(section(text, "Review")).toContain("No entry is left to judge.");
  });

  it("gives no other role's package entries", async () => {
    const h = round();
    seeded(h);
    const { data } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    expect(data).not.toHaveProperty("entries");
  });

  it.each([
    ["--file", ["--range", RANGE, "--file", "src/a.ts"]],
    ["--part", ["--range", RANGE, "--part", "02"]],
    ["no --range", []],
  ])("refuses %s with input/invalid-argument", async (_, flags) => {
    const h = round();
    const result = await grouped(h, "judge", "judge", ...flags);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it("refuses a judge package without --group: the judge judges a review round", async () => {
    const result = await build(round(), CHANGE, "judge", ROUND);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });
});

const GATE_TOOLS =
  "tools:\n" +
  "  test:\n" +
  "    - id: unit\n      tier: fast\n      command: vitest run\n      related: vitest related {files}\n" +
  "      coverage:\n        command: vitest run --coverage\n        report: coverage/lcov.info\n        format: lcov\n        min: 90\n" +
  "    - id: e2e\n      tier: e2e\n      command: vitest run --project e2e\n" +
  "  lint:\n" +
  "    - id: eslint\n      tier: lint\n      command: eslint .\n      scoped: eslint {files}\n";

describe("the gate runner's Checks section (D9)", () => {
  it("lists the full test commands, the coverage run and the full lint commands on the group reference", async () => {
    const h = round();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, GATE_TOOLS);
    const { text } = await groupBuilt(h, "runner", "gate");
    const checks = section(text, "Checks");
    const at = (needle: string) => checks.indexOf(needle);
    expect(at("### tests-full")).toBeGreaterThan(-1);
    expect(at("`vitest run`")).toBeGreaterThan(at("### tests-full"));
    expect(checks).toContain("`vitest run --project e2e`");
    expect(at("`vitest run --coverage`")).toBeGreaterThan(at("`vitest run`"));
    expect(checks).toContain(
      `\`bdk evidence coverage unit coverage/lcov.info --ticket ${ROUND}@gate\``,
    );
    expect(at("### lint-full")).toBeGreaterThan(at("`vitest run --coverage`"));
    expect(at("`eslint .`")).toBeGreaterThan(at("### lint-full"));
    for (const kind of ["tests-full", "lint-full"]) {
      expect(checks).toContain(
        `\`bdk evidence record ${kind} <file> --ticket ${ROUND}@gate --verdict pass|fail|not-run --cite <citation>\``,
      );
    }
    expect(checks).not.toContain("vitest related");
    expect(checks).not.toContain("### tests-scoped");
  });

  it("leaves out the full check of a group declared none (T49)", async () => {
    const h = round();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      GATE_TOOLS.replace(/ {2}lint:\n[\s\S]*$/, "  lint: none\n"),
    );
    const { text } = await groupBuilt(h, "runner", "gate");
    const checks = section(text, "Checks");
    expect(checks).toContain("### tests-full");
    expect(checks).not.toContain("### lint-full");
    expect(checks).not.toContain("eslint");
  });

  it("refuses an ungrouped runner on the round ticket and names the gate group (#166)", async () => {
    const result = await build(round(), CHANGE, "runner", ROUND);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
    expect(JSON.stringify(result.json)).toContain(
      `bdk dispatch build ${CHANGE} runner ${ROUND} --group gate`,
    );
    expect(JSON.stringify(result.json)).toContain(`bdk check run ${CHANGE} --ticket ${ROUND}`);
  });
});

describe("the fix of a round (#166)", () => {
  async function built(role: string) {
    const h = round();
    const result = await build(h, CHANGE, role, ROUND);
    expect(result.code, result.stdout).toBe(0);
    const report = dispatchBuildOutput.parse(result.json);
    return h.store.read(`${ROOT}/${report.path}`) ?? "";
  }

  it("has its implementer check the fix over the Change and commit nothing", async () => {
    const checks = section(await built("implementer"), "Checks");
    expect(checks).toContain(`bdk check run ${CHANGE} --ticket ${ROUND}`);
    expect(checks).toContain(`the orchestrator commits the fix with \`bdk commit ${CHANGE}\``);
    expect(checks).not.toContain("run the `git` command it printed");
  });

  it("has its conformer check the uncommitted fix, not a range", async () => {
    const text = await built("conformer");
    expect(section(text, "Fix")).toContain("`git diff HEAD`");
    expect(text).not.toContain("\n## Range\n");
    expect(section(text, "Checks")).toContain(`bdk check run ${CHANGE} --ticket ${ROUND}`);
  });
});

describe("ticket references", () => {
  it("refuses a malformed group on dispatch show with input/invalid-argument", async () => {
    const result = await round().run(["dispatch", "show", `${ROUND}@P_01`, "--json"]);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("finds no package of an unbuilt group", async () => {
    const result = await round().run(["dispatch", "show", `${ROUND}@p09`, "--json"]);
    expect(result.code, result.stdout).toBe(3);
    expect(rule(result)).toBe("input/not-found");
  });
});

describe("dispatch build implementer on a review-fix ticket (T42-D3)", () => {
  it("embeds every blocking entry in full, whatever its refs, and selects rules by their files", async () => {
    const h = round();
    h.store.write(`${ROOT}/.bdk/rules/API-1.md`, ruleFile("API-1", { paths: ["src/api/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/WEB-1.md`, ruleFile("WEB-1", { paths: ["web/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["src/ui/**"] }));
    const at = "2026-09-25T10:01:00.000Z";
    const triaged = writeEntry(h.store, {
      type: "finding",
      at,
      status: "proposed",
      refs: ["src/api/login.ts#verify"],
      ticket: ROUND,
      level: "blocker",
    });
    const live = writeEntry(h.store, {
      type: "blocker",
      at,
      status: "proposed",
      refs: ["web/forms/form.ts", CHANGE],
      ticket: ROUND,
      level: "should-fix",
    });
    const minor = writeEntry(h.store, {
      type: "finding",
      at,
      status: "proposed",
      refs: ["src/ui/button.ts"],
      ticket: ROUND,
      level: "nice-to-have",
    });

    const result = await build(h, CHANGE, "implementer", ROUND);
    expect(result.code, result.stdout).toBe(0);
    const report = dispatchBuildOutput.parse(result.json);
    const text = h.store.read(`${ROOT}/${report.path}`) ?? "";
    const entries = section(text, "Ledger entries");
    expect(entries).toContain(`### ${triaged} finding, proposed`);
    expect(entries).toContain(`### ${live} blocker, proposed`);
    expect(entries).not.toContain(minor);
    const document = readDocument(h.store, `${ROOT}/${report.path}`);
    const rules = document !== undefined && "data" in document ? document.data.rules : [];
    expect(rules).toEqual(expect.arrayContaining(["API-1", "WEB-1"]));
    expect(rules).not.toContain("UI-1");
  });

  it("embeds no resolved entry triaged blocker", async () => {
    const h = round();
    writeEntry(h.store, {
      type: "finding",
      at: "2026-09-25T10:01:00.000Z",
      status: "resolved",
      refs: ["src/api/login.ts"],
      level: "blocker",
    });
    const fix = await build(h, CHANGE, "implementer", ROUND);
    const path = dispatchBuildOutput.parse(fix.json).path;
    expect(section(h.store.read(`${ROOT}/${path}`) ?? "", "Ledger entries")).toContain(
      "No accepted decision or open blocker names this target.",
    );
  });
});
