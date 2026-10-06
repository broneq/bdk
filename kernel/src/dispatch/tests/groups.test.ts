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

function projectRule(id: string, applies: string): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\napplies: [${applies}]\n---\n\nText of ${id}.\n`;
}

describe("dispatch build --group", () => {
  it("builds the package of every group `bdk review plan` makes at the default review.group.max-files", async () => {
    const h = round();
    const changed = largeRange();
    const groups = reviewGroups({
      changed,
      parts: [],
      maxFiles: 30,
      moduleOf: (path) => path.split("/").slice(0, 2).join("/"),
    });
    expect(groups.length).toBeGreaterThan(2);
    for (const group of groups) {
      const role = group.kind === "integration" ? "integration-reviewer" : "reviewer";
      const files = group.files.flatMap((file) => ["--file", file]);
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
      "02-3",
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
    h.store.write(`${ROOT}/.bdk/rules/API-1.md`, projectRule("API-1", "src/api/**"));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, projectRule("UI-1", "web/**"));
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
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, projectRule("AUTH-1", "src/auth/**"));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, projectRule("UI-1", "web/**"));
    const { data } = await groupBuilt(h, "reviewer", "p02", "--range", RANGE, "--part", "02");
    expect(data.rules).toContain("AUTH-1");
    expect(data.rules).not.toContain("UI-1");
  });

  it("keeps a 30-file group under 12 288 bytes", async () => {
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
    expect(report.bytes).toBeLessThan(12_288);
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
  it("runs on reader with the diff listing, the intent paths and the enabled risks", async () => {
    const h = round();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "review:\n  risks:\n    - id: dependencies\n      enabled: false\n    - id: billing\n      instruction: Call out any change to how invoices are totalled.\n",
    );
    const { report, text } = await groupBuilt(
      h,
      "integration-reviewer",
      "integration",
      "--range",
      RANGE,
    );
    expect(report).toMatchObject({ role: "integration-reviewer", adapter: "reader", files: [] });
    const review = section(text, "Review");
    expect(review).toContain(`\`git diff --name-only ${RANGE}\``);
    expect(review).toContain(`\`.bdk/changes/${CHANGE}/change.md\``);
    const risks = section(text, "Risks");
    for (const id of ["auth", "migration", "secrets", "public-api", "billing"]) {
      expect(risks).toContain(`\`${id}\``);
    }
    expect(risks).not.toContain("`dependencies`");
    expect(risks).toContain("Call out any change to how invoices are totalled.");
    expect(text).toContain("## Role: integration-reviewer");
  });

  it("reads only the ARCH, SEC and TQ packs", async () => {
    const h = round();
    const { data } = await groupBuilt(h, "integration-reviewer", "integration", "--range", RANGE);
    const packs = new Set(
      (data.rules as string[]).filter((id) => id.startsWith("BDK-")).map((id) => id.split("-")[1]),
    );
    expect([...packs].sort()).toStrictEqual(["ARCH", "SEC", "TQ"]);
  });

  it("has no Risks section in another role's package", async () => {
    const { text } = await groupBuilt(round(), "reviewer", "p01", "--range", RANGE);
    expect(text).not.toContain("\n## Risks\n");
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

  it("keeps the post-fix steps for an ungrouped runner on the same ticket", async () => {
    const h = round();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, GATE_TOOLS);
    const result = await build(h, CHANGE, "runner", ROUND);
    expect(result.code, result.stdout).toBe(0);
    const text = h.store.read(`${ROOT}/${dispatchBuildOutput.parse(result.json).path}`) ?? "";
    const checks = section(text, "Checks");
    expect(checks).toContain("### tests-scoped");
    expect(checks).toContain("### lint");
    expect(checks).not.toContain("### tests-full");
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
    h.store.write(`${ROOT}/.bdk/rules/API-1.md`, projectRule("API-1", "src/api/**"));
    h.store.write(`${ROOT}/.bdk/rules/WEB-1.md`, projectRule("WEB-1", "web/**"));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, projectRule("UI-1", "src/ui/**"));
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
