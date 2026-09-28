// `bdk dispatch build` and `dispatch show` (`kernel-cli/dispatch`; T23-D31 to
// D33, D37) through the registry on a memory store: the template's sections,
// the target bodies, entry selection, the verifier lists, the template hash
// and the refusals.
import { describe, expect, it } from "vitest";

import { kindRegistry, PostTaskStepKind } from "../../graph/domain/kinds/index.ts";
import { writeEntry } from "../../graph/tests/support.ts";
import { repository, ROOT } from "../../log/tests/support.ts";
import { activePackage, readDocument } from "../../shared/store/index.ts";
import { dispatchBuildOutput, dispatchShowOutput } from "../schema/outputs.ts";
import {
  build,
  dispatchHarness,
  DIR,
  PLUGIN,
  ticket,
  TICKET,
  withDispatchPlugin,
} from "./support.ts";
import type { DispatchHarness } from "./support.ts";

function refusal(result: { json: unknown }) {
  return result.json as { rule: string; why: string };
}

async function built(h: DispatchHarness, ...argv: string[]) {
  const result = await build(h, ...argv);
  expect(result.code, result.stdout).toBe(0);
  const report = dispatchBuildOutput.parse(result.json);
  const text = h.store.read(`${ROOT}/${report.path}`) ?? "";
  return { report, text, body: text.slice(text.indexOf("\n---\n") + 5) };
}

function headings(body: string): string[] {
  return body.split("\n").filter((line) => /^#{1,2} /.test(line));
}

describe("dispatch build", () => {
  it("writes the implementer's package with the stamped frontmatter and the sections in order", async () => {
    const h = dispatchHarness();
    const { report, text, body } = await built(h);
    expect(report).toMatchObject({
      path: `.bdk/changes/2026-09-25-login/dispatch/02-3-implementer-${TICKET}.md`,
      ticket: TICKET,
      target: "02-3",
      role: "implementer",
      adapter: "worker",
      scope: "full",
      kernelVersion: "3.0.0",
      report: `.bdk/changes/2026-09-25-login/reports/02-3-implementer-${TICKET}.md`,
    });
    expect(report.bytes).toBe(new TextEncoder().encode(text).length);
    expect(readDocument(h.store, `${ROOT}/${report.path}`)).toMatchObject({
      kind: "dispatch",
      data: {
        attempt: 1,
        of: 3,
        at: "2026-09-25T10:05:00.000Z",
        "template-hash": report.templateHash,
      },
    });
    const own = headings(body).filter((line) =>
      [
        "# BDK",
        "## Change",
        "## Target",
        "## Ledger",
        "## Role: implementer",
        "## Rules",
        "## Return",
      ].some((prefix) => line.startsWith(prefix)),
    );
    expect(own).toStrictEqual([
      `# BDK dispatch package ${TICKET}`,
      "## Change",
      "## Target 02-3",
      "## Ledger entries",
      "## Role: implementer",
      "## Rules",
      "## Return",
    ]);
    expect(body).toContain("Users log in with a one-time link.");
    expect(body).toContain(`bdk rules show --ticket ${TICKET}`);
    expect(body).toContain(`bdk log ingest --ticket ${TICKET}`);
    expect(body).not.toContain("## Blocking categories");
  });

  it("embeds the task's full text with its Files, stop rule and do-not-touch", async () => {
    const { body } = await built(dispatchHarness());
    expect(body).toContain("From `.bdk/changes/2026-09-25-login/plan/parts/02-part.md`:");
    expect(body).toContain("\n### 02-3 Verify the link\n");
    expect(body).toContain("- Create: `src/auth/verify.ts`");
    expect(body).toContain("**Stop rule:** stop when the token format is unclear");
    expect(body).toContain("`do-not-touch`: `src/billing/**`.");
    expect(body).not.toContain("## 02-1 Store the token");
  });

  it("embeds the role body from the plugin without its frontmatter, headings one level down", async () => {
    const h = dispatchHarness();
    const { body } = await built(h);
    const skill = h.store.read(`${PLUGIN}/skills/roles/implementer/SKILL.md`) ?? "";
    const skillBody = skill.slice(skill.indexOf("\n---\n") + 5).trim();
    expect(body).toContain(skillBody.replace(/^(#{1,5} )/gm, "#$1"));
    expect(body).toContain("\n## Role: implementer\n");
    expect(body).not.toContain("user-invocable:");
  });

  it("names the plan part for a part target", async () => {
    const h = dispatchHarness();
    ticket(h.store, { target: "02", loop: "verify-fix", id: "A-p4r7t2w9" });
    const { body } = await built(h, "02", "implementer", "A-p4r7t2w9");
    expect(body).toContain("- `.bdk/changes/2026-09-25-login/plan/parts/02-part.md`");
    expect(body).not.toContain("\n### 02-3 Verify the link\n");
  });

  it("names the plan parts an artifact target requires, from the graph", async () => {
    const h = dispatchHarness();
    ticket(h.store, { target: "plan-verify", loop: "verifier", id: "A-v3r1f7y2" });
    const { body } = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(body).toContain("- `.bdk/changes/2026-09-25-login/plan/parts/02-part.md`");
  });

  it("embeds accepted decisions and open blockers by target, part and Files; counts the rest", async () => {
    const h = dispatchHarness();
    const accepted = writeEntry(h.store, {
      type: "decision",
      at: "2026-09-25T10:01:00.000Z",
      summary: "tokens are single use",
      refs: ["02-3"],
    });
    writeEntry(h.store, {
      type: "decision",
      at: "2026-09-25T10:01:01.000Z",
      status: "proposed",
      summary: "maybe rotate keys",
      refs: ["02-3"],
    });
    const blocker = writeEntry(h.store, {
      type: "blocker",
      at: "2026-09-25T10:01:02.000Z",
      status: "proposed",
      summary: "the clock source is unknown",
      refs: ["02"],
    });
    writeEntry(h.store, {
      type: "blocker",
      at: "2026-09-25T10:01:03.000Z",
      status: "resolved",
      summary: "old blocker",
      refs: ["02-3"],
    });
    const byFile = writeEntry(h.store, {
      type: "decision",
      at: "2026-09-25T10:01:04.000Z",
      summary: "verify.ts owns expiry",
      refs: ["src/auth/verify.ts#verifyLink"],
    });
    for (const at of ["10:01:05", "10:01:06"]) {
      writeEntry(h.store, {
        type: "finding",
        at: `2026-09-25T${at}Z`,
        status: "proposed",
        summary: "finding",
        refs: ["02-3"],
      });
    }
    writeEntry(h.store, {
      type: "decision",
      at: "2026-09-25T10:01:07.000Z",
      summary: "another part",
      refs: ["03-1"],
    });
    const { report, body } = await built(h);
    expect(report.entries.full).toStrictEqual([accepted, blocker, byFile]);
    expect(report.entries.counted).toStrictEqual({ decision: 1, blocker: 1, finding: 2 });
    expect(body).toContain(`### ${accepted} decision, accepted\n\ntokens are single use`);
    expect(body).toContain("Other entries of this target: 1 decision, 1 blocker, 2 finding");
    expect(body).toContain("`bdk log list --for 02-3`");
    expect(body).not.toContain("another part");
  });

  it("lists the verifier categories, a project category included, then not-a-fail", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "policy:\n  verifier:\n    blocking-categories:\n      - id: accessibility\n        description: An accessibility regression.\n",
    );
    ticket(h.store, { target: "plan-verify", loop: "verifier", id: "A-v3r1f7y2" });
    const { report, body } = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(report.adapter).toBe("reader");
    const categories = body.slice(
      body.indexOf("## Blocking categories (P8)"),
      body.indexOf("## Not a fail"),
    );
    expect([...categories.matchAll(/^- `([a-z-]+)`/gm)].map((match) => match[1])).toStrictEqual([
      "architecture",
      "security",
      "irreversible-step",
      "integration-failure",
      "unresolved-decision",
      "false-code-claim",
      "accessibility",
    ]);
    expect(body.indexOf("## Not a fail")).toBeLessThan(body.indexOf("## Return"));
    expect(body).toContain("- `verification-defect`:");
  });

  it("keeps the template hash for the same inputs and changes it with the role body or a rule", async () => {
    const h = dispatchHarness();
    const first = (await built(h)).report.templateHash;
    h.store.write(
      `${DIR}/log/20260925T100100Z-finding-L-aaaaaaa1.md`,
      "---\nschema: 1\nid: L-aaaaaaa1\ntype: finding\nsummary: s\nstatus: proposed\nsource: user\nauthor: Ada Lovelace <ada@example.com>\nat: 2026-09-25T10:01:00.000Z\nrefs: [02-3]\n---\n",
    );
    expect((await built(h)).report.templateHash).toBe(first);
    const skill = `${PLUGIN}/skills/roles/implementer/SKILL.md`;
    const original = h.store.read(skill) ?? "";
    h.store.write(skill, `${original.replace(/\n+$/, "")}   \r\n`);
    expect((await built(h)).report.templateHash).toBe(first);
    h.store.write(skill, `${original}\nOne more rule.\n`);
    const changed = (await built(h)).report.templateHash;
    expect(changed).not.toBe(first);
    h.store.write(`${ROOT}/.bdk/prompts/rules/security.md`, "- **Project.** Our rule.\n");
    expect((await built(h)).report.templateHash).not.toBe(changed);
  });

  it("keeps one package per role of a ticket and stamps the newest as the active package", async () => {
    const h = dispatchHarness();
    await built(h);
    const simplifier = await built(h, "02-3", "simplifier", TICKET);
    expect(simplifier.report.adapter).toBe("worker");
    const runner = await built(h, "02-3", "runner", TICKET);
    expect(h.store.list(`${DIR}/dispatch`).sort()).toStrictEqual([
      `02-3-implementer-${TICKET}.md`,
      `02-3-runner-${TICKET}.md`,
      `02-3-simplifier-${TICKET}.md`,
    ]);
    expect(activePackage(h.store, ROOT, DIR, TICKET)?.path).toBe(runner.report.path);
    const shown = await h.run(["dispatch", "show", TICKET, "--json"]);
    expect(dispatchShowOutput.parse(shown.json)).toMatchObject({
      path: runner.report.path,
      frontmatter: { role: "runner" },
    });
  });

  it("replaces a rebuilt role package of the ticket", async () => {
    const h = dispatchHarness();
    await built(h, "02-3", "runner", TICKET);
    await built(h, "02-3", "runner", TICKET);
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([`02-3-runner-${TICKET}.md`]);
  });

  it("embeds the simplifier's role body for a simplifier package", async () => {
    const { body, report } = await built(dispatchHarness(), "02-3", "simplifier", TICKET);
    expect(report).toMatchObject({ role: "simplifier", adapter: "worker" });
    expect(body).toContain("## Role: simplifier");
  });

  it("refuses a Files item holding a placeholder with policy/placeholder", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${DIR}/plan/parts/02-part.md`,
      (h.store.read(`${DIR}/plan/parts/02-part.md`) ?? "").replace(
        "`src/auth/verify.ts`",
        "`TODO`",
      ),
    );
    const result = await build(h);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/placeholder" });
    expect(refusal(result).why).toContain("task 02-3 **Files:** item 1");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it("refuses a package above 12 288 bytes naming its size and largest section", async () => {
    const h = dispatchHarness();
    writeEntry(h.store, {
      type: "decision",
      at: "2026-09-25T10:01:00.000Z",
      summary: "a long decision",
      refs: ["02-3"],
    });
    const entry = h.store.list(`${DIR}/log`).find((name) => name.includes("decision")) ?? "";
    h.store.write(
      `${DIR}/log/${entry}`,
      `${h.store.read(`${DIR}/log/${entry}`) ?? ""}${"x".repeat(12_000)}\n`,
    );
    const result = await build(h);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/package-too-large" });
    expect(refusal(result).why).toMatch(
      /^the package is \d+ bytes, above 12288; the largest section is entries/,
    );
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it.each([
    ["closed", { closed: true }, ["02-3", "implementer", TICKET]],
    ["missing", {}, ["02-3", "implementer", "A-00000000"]],
    ["on another target", {}, ["02-1", "implementer", TICKET]],
  ] as const)("refuses a ticket %s with policy/no-open-ticket", async (_, fields, argv) => {
    const h = dispatchHarness();
    ticket(h.store, fields);
    const result = await build(h, ...argv);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/no-open-ticket" });
  });

  it.each([["09-1"], ["09"], ["no-such-artifact"]])(
    "refuses the target %s the Change does not hold with input/not-found",
    async (target) => {
      const result = await build(dispatchHarness(), target, "implementer", TICKET);
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/not-found" });
    },
  );

  it("refuses a role outside the eight with input/invalid-argument", async () => {
    const result = await build(dispatchHarness(), "02-3", "planner", TICKET);
    expect(result.code).toBe(3);
    expect(refusal(result)).toMatchObject({ rule: "input/invalid-argument" });
  });
});

const TOOLS =
  "tools:\n" +
  "  test:\n" +
  "    - id: unit\n      tier: fast\n      command: vitest run\n      related: vitest related {files}\n      when: after every source change\n" +
  "    - id: slow\n      tier: e2e\n      command: vitest run --project e2e\n" +
  "  lint:\n" +
  "    - id: eslint\n      tier: lint\n      command: eslint .\n      scoped: eslint {files}\n" +
  "    - id: tsc\n      tier: typecheck\n      command: tsc --noEmit\n";

/** The `## Checks` section of a runner package, up to the next section. */
function checks(body: string): string {
  const start = body.indexOf("## Checks");
  expect(start).toBeGreaterThan(-1);
  return body.slice(start, body.indexOf("\n## ", start + 1));
}

/** Task 02-3 with a Markdown file next to its sources. */
function withDocs(h: ReturnType<typeof dispatchHarness>): void {
  const path = `${DIR}/plan/parts/02-part.md`;
  h.store.write(
    path,
    (h.store.read(path) ?? "").replace(
      "- Test: `src/auth/verify.test.ts`",
      "- Test: `src/auth/verify.test.ts`\n- Modify: `docs/login.md`",
    ),
  );
}

describe("the runner's Checks section (T23-D44)", () => {
  it("names each step's commands with the target's executable files and its record line", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOLS);
    withDocs(h);
    const section = checks((await built(h, "02-3", "runner", TICKET)).body);
    const files = "src/auth/verify.test.ts src/auth/verify.ts";
    expect(section).toContain(`### tests-scoped`);
    expect(section).toContain(`\`vitest related ${files}\``);
    expect(section).toContain("after every source change");
    expect(section).not.toContain("vitest run --project e2e");
    expect(section).toContain(`\`eslint ${files}\``);
    expect(section).toContain("`tsc --noEmit`");
    expect(section).not.toContain("docs/login.md");
    expect(section).not.toContain("### simplify");
    for (const kind of ["tests-scoped", "lint"]) {
      expect(section).toContain(
        `\`bdk evidence record ${kind} <file> --ticket ${TICKET} --verdict pass|fail|not-run --cite <citation>\``,
      );
    }
    expect(section.indexOf("### tests-scoped")).toBeLessThan(section.indexOf("### lint"));
  });

  it("tells the runner to end each output file with the exit code and cite only what the check wrote", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOLS);
    const section = checks((await built(h, "02-3", "runner", TICKET)).body);
    expect(section).toContain("end the file with the line `exit <code>`");
    expect(section).toMatch(/never write or edit the output yourself/);
  });

  it("uses the scoped form, else the command, of a fast test entry", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: pytest\n      scoped: pytest {files}\n    - id: doc\n      tier: fast\n      command: pytest --doctest-modules\n",
    );
    const section = checks((await built(h, "02-3", "runner", TICKET)).body);
    expect(section).toContain("`pytest src/auth/verify.test.ts src/auth/verify.ts`");
    expect(section).toContain("`pytest --doctest-modules`");
  });

  it("tells the runner to record a kind without a command as not-run with the reason", async () => {
    const section = checks((await built(dispatchHarness(), "02-3", "runner", TICKET)).body);
    expect(section).toMatch(/### lint\n\nNo command is configured[^\n]*`--verdict not-run`/);
  });

  it("tells the runner to record every check not-run when the target has no executable file", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOLS);
    const path = `${DIR}/plan/parts/02-part.md`;
    h.store.write(
      path,
      (h.store.read(path) ?? "")
        .replace("`src/auth/verify.ts`", "`docs/verify.md`")
        .replace("`src/auth/verify.test.ts`", "`docs/verify-notes.md`"),
    );
    const section = checks((await built(h, "02-3", "runner", TICKET)).body);
    expect(section).not.toContain("vitest");
    expect(section.match(/The target has no executable file/g)).toHaveLength(2);
  });

  it("follows the order of the step nodes in the pipeline, a project kind included", async () => {
    const store = withDispatchPlugin(repository());
    const path = `${PLUGIN}/pipeline/pipeline.yaml`;
    const pipeline = (store.read(path) ?? "")
      .replace(/\n {2}- id: tests-scoped\n( {4}.*\n)+/, "\n")
      .replace(
        /(\n {2}- id: lint\n( {4}.*\n)+)/,
        "$1  - id: contract-snapshot\n    kind: contract-snapshot\n    stage: execute\n    requires: [simplify]\n  - id: tests-scoped\n    kind: tests-scoped\n    stage: execute\n    requires: [simplify]\n",
      );
    store.write(path, pipeline);
    const snapshot = new PostTaskStepKind(
      "contract-snapshot",
      "bdk evidence record contract-snapshot <file> --ticket <ticket>",
      "runner",
    );
    const h = dispatchHarness(store, kindRegistry([snapshot]));
    const section = checks((await built(h, "02-3", "runner", TICKET)).body);
    const at = (kind: string) => section.indexOf(`### ${kind}\n`);
    expect(at("lint")).toBeGreaterThan(-1);
    expect(at("lint")).toBeLessThan(at("contract-snapshot"));
    expect(at("contract-snapshot")).toBeLessThan(at("tests-scoped"));
    expect(section).toMatch(/### contract-snapshot\n\nNo command is configured/);
  });

  it("is absent from every other role's package", async () => {
    const { body } = await built(dispatchHarness(), "02-3", "implementer", TICKET);
    expect(body).not.toContain("## Checks");
  });
});

describe("dispatch show", () => {
  it("prints the package by ticket and by path, byte for byte", async () => {
    const h = dispatchHarness();
    const { report, text } = await built(h);
    const byTicket = await h.run(["dispatch", "show", TICKET, "--json"]);
    expect(dispatchShowOutput.parse(byTicket.json)).toMatchObject({
      path: report.path,
      content: text,
      frontmatter: { ticket: TICKET, role: "implementer", adapter: "worker" },
    });
    const byPath = await h.run(["dispatch", "show", report.path]);
    expect(byPath.stdout).toBe(text);
  });

  it.each([["A-00000000"], [".bdk/changes/2026-09-25-login/change.md"], ["missing.md"]])(
    "refuses %s with input/not-found",
    async (value) => {
      const h = dispatchHarness();
      await built(h);
      const result = await h.run(["dispatch", "show", value, "--json"]);
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/not-found" });
    },
  );
});
