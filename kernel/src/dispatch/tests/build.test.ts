// `bdk dispatch build` and `dispatch show` (`kernel-cli/dispatch`; T23-D31 to
// D33, D37) through the registry on a memory store: the template's sections,
// the target bodies, entry selection, the verifier lists, the template hash,
// the part agents' Tasks and Checks sections (#166) and the refusals.
import { describe, expect, it } from "vitest";

import { kindRegistry, PostTaskStepKind } from "../../graph/domain/kinds/index.ts";
import { setChange, writeDesign, writeEntry, writePlanPart } from "../../graph/tests/support.ts";
import { repository, ROOT } from "../../log/tests/support.ts";
import { activePackage, readDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { demoteHeadings } from "../../ctx/index.ts";
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
import { ruleFile } from "../../../tests/support/rule-file.ts";

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

/** The frontmatter a package stamps. */
function stamped(store: Store, path: string): Record<string, unknown> {
  const document = readDocument(store, `${ROOT}/${path}`);
  return document !== undefined && "data" in document ? document.data : {};
}

/** The rule ids a package stamps. */
function stampedRules(store: Store, path: string): string[] {
  return stamped(store, path).rules as string[];
}

function headings(body: string): string[] {
  return body.split("\n").filter((line) => /^#{1,2} /.test(line));
}

describe("dispatch build", () => {
  it("writes the implementer's package with the stamped frontmatter and the sections in order", async () => {
    const h = dispatchHarness();
    const { report, text, body } = await built(h);
    expect(report).toMatchObject({
      path: `.bdk/changes/2026-09-25-login/dispatch/02-implementer-${TICKET}.md`,
      ticket: TICKET,
      target: "02",
      role: "implementer",
      adapter: "worker",
      scope: "full",
      kernelVersion: "3.0.0",
      report: `.bdk/changes/2026-09-25-login/reports/02-implementer-${TICKET}.md`,
    });
    expect(report.bytes).toBe(new TextEncoder().encode(text).length);
    expect(readDocument(h.store, `${ROOT}/${report.path}`)).toMatchObject({
      kind: "dispatch",
      data: {
        attempt: 1,
        of: 3,
        at: "2026-09-25T10:05:00.000Z",
        "template-hash": report.templateHash,
        draft: `.bdk/.machine/drafts/02-implementer-${TICKET}.md`,
      },
    });
    const own = headings(body).filter((line) =>
      [
        "# BDK",
        "## Change",
        "## Target",
        "## Tasks",
        "## Ledger",
        "## Role: implementer",
        "## Rules",
        "## Checks",
        "## Return",
      ].some((prefix) => line.startsWith(prefix)),
    );
    expect(own).toStrictEqual([
      `# BDK dispatch package ${TICKET}`,
      "## Change",
      "## Target 02",
      "## Tasks",
      "## Ledger entries",
      "## Role: implementer",
      "## Rules",
      "## Checks",
      "## Return",
    ]);
    expect(body).toContain("Users log in with a one-time link.");
    expect(body).toContain(`bdk rules show --ticket ${TICKET}`);
    expect(body).toContain(
      `bdk log ingest --ticket ${TICKET} --file .bdk/.machine/drafts/02-implementer-${TICKET}.md`,
    );
    expect(body).not.toContain("## Blocking categories");
  });

  it("embeds the whole part with every task's Files, stop rule and do-not-touch", async () => {
    const { body } = await built(dispatchHarness());
    expect(body).toContain("From `.bdk/changes/2026-09-25-login/plan/parts/02-part.md`:");
    expect(body).toContain("\n### 02-1 Store the token\n");
    expect(body).toContain("\n### 02-3 Verify the link\n");
    expect(body).toContain("- Create: `src/auth/verify.ts`");
    expect(body).toContain("**Stop rule:** stop when the token format is unclear");
    expect(body).toContain("`do-not-touch`: `src/billing/**`.");
  });

  it("embeds the part's preamble before its tasks (#166)", async () => {
    const h = dispatchHarness();
    const path = `${DIR}/plan/parts/02-part.md`;
    const preamble = "Copy the shape of `src/auth/session.ts` for every store.";
    h.store.write(path, (h.store.read(path) ?? "").replace("## 02-1", `${preamble}\n\n## 02-1`));
    const { body } = await built(h);
    expect(body).toContain(preamble);
    expect(body.indexOf(preamble)).toBeLessThan(body.indexOf("### 02-1 Store the token"));
  });

  it("embeds the role body from the plugin without its frontmatter, headings one level down", async () => {
    const h = dispatchHarness();
    const { body } = await built(h);
    const skill = h.store.read(`${PLUGIN}/skills/roles/implementer/SKILL.md`) ?? "";
    const skillBody = skill.slice(skill.indexOf("\n---\n") + 5).trim();
    const loaded = skillBody.replaceAll("${CLAUDE_PLUGIN_ROOT}", PLUGIN);
    expect(body).toContain(demoteHeadings(loaded));
    expect(body).not.toContain("${CLAUDE_PLUGIN_ROOT}");
    expect(body).toContain("\n## Role: implementer\n");
    expect(body).not.toContain("user-invocable:");
  });

  it("checks the whole part on a verify-fix ticket", async () => {
    const h = dispatchHarness();
    ticket(h.store, { target: "02", loop: "verify-fix", id: "A-p4r7t2w9" });
    const { body } = await built(h, "02", "implementer", "A-p4r7t2w9");
    expect(body).toContain("\n### 02-3 Verify the link\n");
    expect(body).toContain("## Tasks");
    expect(body).toContain("- `bdk check run 02 --ticket A-p4r7t2w9`");
    expect(body).not.toContain("bdk check run 02-3");
  });

  it("names the plan parts and the design documents an artifact target requires, from the graph", async () => {
    const h = dispatchHarness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    ticket(h.store, { target: "plan-verify", loop: "verifier", id: "A-v3r1f7y2" });
    const { body } = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(body).toContain("- `.bdk/changes/2026-09-25-login/plan/parts/02-part.md`");
    expect(body).toContain("- `.bdk/changes/2026-09-25-login/design.md`");
    expect(body).toContain("- `.bdk/changes/2026-09-25-login/architecture.md`");
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
    expect(body).toContain("`bdk log list --for 02`");
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
      "costly-command",
      "accessibility",
    ]);
    expect(body.indexOf("## Not a fail")).toBeLessThan(body.indexOf("## Return"));
    expect(body).toContain("- `verification-defect`:");
    expect(categories).toContain(
      "A blocker names one of these with `bdk log add blocker <summary> --ref <ref> --ticket A-v3r1f7y2 --category <id>`; any other blocker is stored as an observation for review.",
    );
    expect(categories).not.toContain("can be triaged");
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
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, ruleFile("AUTH-1"));
    expect((await built(h)).report.templateHash).not.toBe(changed);
  });

  it("stamps the selected rule ids in order", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, ruleFile("AUTH-1", { paths: ["src/auth/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["web/**"] }));
    h.store.write(`${ROOT}/.bdk/rules/PLAN-1.md`, ruleFile("PLAN-1", { stages: ["plan"] }));
    h.store.write(`${ROOT}/.bdk/rules/NAMING-1.md`, ruleFile("NAMING-1"));
    const { report } = await built(h, "02", "reviewer", TICKET);
    const rules = stampedRules(h.store, report.path);
    expect(rules.filter((id) => !id.startsWith("BDK-"))).toStrictEqual(["NAMING-1", "AUTH-1"]);
    // The pack's global reviewer rules come too, all of them: there is no cap.
    expect(rules).toContain("BDK-CQ-1");
    expect(rules.filter((id) => id.startsWith("BDK-TQ-"))).toHaveLength(11);
    expect(stamped(h.store, report.path)).not.toHaveProperty("rules-truncated");
  });

  it("records the same rules for every role of a stage", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, ruleFile("AUTH-1", { paths: ["src/auth/**"] }));
    const reviewer = await built(h, "02", "reviewer", TICKET);
    const integration = await built(h, "02", "integration-reviewer", TICKET);
    expect(stampedRules(h.store, integration.report.path)).toStrictEqual(
      stampedRules(h.store, reviewer.report.path),
    );
  });

  it("stages and paths select a project rule", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/rules/E2E-1.md`,
      ruleFile("E2E-1", { paths: ["tests/e2e/**"], stages: ["plan", "execute", "review"] }),
    );
    writePlanPart(h.store, "03", {
      body: "## 03-1 Login journey\n\n**Files:**\n\n- Create: `tests/e2e/login.spec.ts`\n\n**Test cases:**\n\n- logs in\n",
    });
    ticket(h.store, { target: "03", id: "A-e2e0test" });
    const e2e = await built(h, "03", "implementer", "A-e2e0test");
    expect(stampedRules(h.store, e2e.report.path)).toContain("E2E-1");
    const app = await built(h, "02", "implementer", TICKET);
    expect(stampedRules(h.store, app.report.path)).not.toContain("E2E-1");
    h.git.workTree.push("tests/e2e/login.spec.ts");
    writeDesign(h.store, "design");
    ticket(h.store, { target: "design-verify", loop: "verifier", id: "A-d3s1gn00" });
    const design = await built(h, "design-verify", "design-verifier", "A-d3s1gn00");
    expect(stampedRules(h.store, design.report.path)).not.toContain("E2E-1");
  });

  it("selects over the work tree files for a target without files", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/rules/PY-1.md`,
      ruleFile("PY-1", { paths: ["**/*.py"], stages: ["plan"] }),
    );
    ticket(h.store, { target: "plan-verify", loop: "verifier", id: "A-v3r1f7y2" });
    h.git.workTree.push("src/app.ts");
    const without = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(stampedRules(h.store, without.report.path)).not.toContain("PY-1");
    h.git.workTree.push("tools/gen.py");
    const withPython = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(stampedRules(h.store, withPython.report.path)).toContain("PY-1");
  });

  it("selects by the union of a part's tasks' files", async () => {
    const h = dispatchHarness();
    ticket(h.store, { target: "02", loop: "review-fix", id: "A-p4r7t0k2" });
    h.store.write(
      `${ROOT}/.bdk/rules/STORE-1.md`,
      ruleFile("STORE-1", { paths: ["src/auth/store.ts"] }),
    );
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["web/**"] }));
    const { report } = await built(h, "02", "reviewer", "A-p4r7t0k2");
    const rules = stampedRules(h.store, report.path);
    expect(rules.filter((id) => !id.startsWith("BDK-"))).toStrictEqual(["STORE-1"]);
  });

  it("changes the hash with a selected rule's text or id, not with an unselected rule", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/rules/AUTH-1.md`, ruleFile("AUTH-1", { paths: ["src/auth/**"] }));
    const first = (await built(h)).report.templateHash;
    h.store.write(`${ROOT}/.bdk/rules/UI-1.md`, ruleFile("UI-1", { paths: ["web/**"] }));
    expect((await built(h)).report.templateHash).toBe(first);
    h.store.write(
      `${ROOT}/.bdk/rules/AUTH-1.md`,
      ruleFile("AUTH-1", { paths: ["src/auth/**"] }).replace("Text of", "New text of"),
    );
    const edited = (await built(h)).report.templateHash;
    expect(edited).not.toBe(first);
    h.store.remove(`${ROOT}/.bdk/rules/AUTH-1.md`);
    h.store.write(
      `${ROOT}/.bdk/rules/AUTH-2.md`,
      ruleFile("AUTH-2", { paths: ["src/auth/**"] }).replace(
        "Text of AUTH-2",
        "New text of AUTH-1",
      ),
    );
    expect((await built(h)).report.templateHash).not.toBe(edited);
  });

  it("keeps one package per role of a ticket and stamps the newest as the active package", async () => {
    const h = dispatchHarness();
    await built(h);
    const conformer = await built(h, "02", "conformer", TICKET);
    expect(conformer.report.adapter).toBe("worker");
    expect(h.store.list(`${DIR}/dispatch`).sort()).toStrictEqual([
      `02-conformer-${TICKET}.md`,
      `02-implementer-${TICKET}.md`,
    ]);
    expect(activePackage(h.store, ROOT, DIR, TICKET)?.path).toBe(conformer.report.path);
    const shown = await h.run(["dispatch", "show", TICKET, "--json"]);
    expect(dispatchShowOutput.parse(shown.json)).toMatchObject({
      path: conformer.report.path,
      frontmatter: { role: "conformer" },
    });
  });

  it("replaces a rebuilt role package of the ticket", async () => {
    const h = dispatchHarness();
    await built(h, "02", "conformer", TICKET);
    await built(h, "02", "conformer", TICKET);
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([`02-conformer-${TICKET}.md`]);
  });

  it("gives the conformer its range, the project instructions and the part's check run (#166)", async () => {
    const h = dispatchHarness();
    h.store.remove(`${DIR}/attempts/part-02-${TICKET}.md`);
    ticket(h.store, { base: "4c1d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d" });
    h.store.write(`${ROOT}/CLAUDE.md`, "# Project\n");
    h.store.write(`${ROOT}/.claude/rules/api.md`, "# API\n");
    h.store.write(`${ROOT}/.claude/rules/notes.txt`, "not a rule\n");
    const { body, report } = await built(h, "02", "conformer", TICKET);
    expect(report).toMatchObject({ role: "conformer", adapter: "worker" });
    expect(body).toContain("## Role: conformer");
    expect(body).toContain(
      "`git diff 4c1d2e3..HEAD -- src/auth/store.ts src/auth/verify.ts src/auth/verify.test.ts`",
    );
    const instructions = body.slice(body.indexOf("## Project instructions"));
    expect(instructions).toContain("- `CLAUDE.md`\n- `.claude/rules/api.md`");
    expect(instructions).not.toContain("AGENTS.md");
    expect(instructions).not.toContain("notes.txt");
    expect(body).toContain(`- \`bdk check run 02 --ticket ${TICKET}\``);
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

  it("refuses a package above 160 KiB naming its size and largest section [S-DISPATCH]", async () => {
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
      `${h.store.read(`${DIR}/log/${entry}`) ?? ""}${"x".repeat(170_000)}\n`,
    );
    const result = await build(h);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/package-too-large" });
    expect(refusal(result).why).toMatch(
      /^the package is \d+ bytes, above 163840; the largest section is entries/,
    );
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it.each([
    ["closed", { closed: true }, ["02", "implementer", TICKET]],
    ["missing", {}, ["02", "implementer", "A-00000000"]],
    [
      "on another target",
      { target: "plan-verify", loop: "verifier" },
      ["02", "implementer", TICKET],
    ],
  ] as const)("refuses a ticket %s with policy/no-open-ticket", async (_, fields, argv) => {
    const h = dispatchHarness();
    h.store.remove(`${DIR}/attempts/part-02-${TICKET}.md`);
    ticket(h.store, fields);
    const result = await build(h, ...argv);
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({ rule: "policy/no-open-ticket" });
  });

  it.each([["09"], ["no-such-artifact"]])(
    "refuses the target %s the Change does not hold with input/not-found",
    async (target) => {
      const result = await build(dispatchHarness(), target, "implementer", TICKET);
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/not-found" });
    },
  );

  it.each(["planner", "lead", "simplifier"])(
    "refuses the role %s outside the nine with input/invalid-argument",
    async (role) => {
      const result = await build(dispatchHarness(), "02", role, TICKET);
      expect(result.code).toBe(3);
      expect(refusal(result)).toMatchObject({ rule: "input/invalid-argument" });
    },
  );

  it("refuses a task target naming its part, since no ticket targets a task (#166)", async () => {
    const h = dispatchHarness();
    const result = await build(h, "02-3", "implementer", TICKET);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/invalid-argument");
    expect(refusal(result).why).toContain("02");
    expect(h.store.list(`${DIR}/dispatch`)).toStrictEqual([]);
  });

  it("refuses an ungrouped runner naming bdk check run (#166)", async () => {
    const result = await build(dispatchHarness(), "02", "runner", TICKET);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/invalid-argument");
    expect(JSON.stringify(result.json)).toContain("bdk check run");
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

/** The `## Checks` section of a package, up to the next section. */
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

/** A trailer commit of task 02-1, as `git log` prints it for `trailerCommits`. */
function committed(h: DispatchHarness): void {
  const run = h.git.run.bind(h.git);
  h.git.run = (args, cwd) =>
    args[0] === "log"
      ? Promise.resolve({
          code: 0,
          stdout: "c0ffee1\x1fp0\x1fstore the token\x1f2026-09-25-login\x1f02\x1f02-1\x1e",
          stderr: "",
        })
      : run(args, cwd);
}

describe("the part's Checks section (#166)", () => {
  it("names a check run per open task and the commands each kernel-run kind runs", async () => {
    const h = dispatchHarness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, TOOLS);
    withDocs(h);
    const section = checks((await built(h)).body);
    expect(section).toContain(`- \`bdk check run 02-1 --ticket ${TICKET}\``);
    expect(section).toContain(`- \`bdk check run 02-3 --ticket ${TICKET}\``);
    expect(section).toContain("Never compose, run or record a check yourself");
    expect(section).toContain(`under \`.bdk/.machine/checks/${TICKET}/\``);
    expect(section).toContain(
      "- `unit`: `vitest related {files}`, skippable with `--skip unit` when it does not apply: after every source change",
    );
    expect(section).not.toContain("vitest run --project e2e");
    expect(section).toContain("- `eslint`: `eslint {files}`");
    expect(section).toContain("- `tsc`: `tsc --noEmit`");
    expect(section).not.toContain("docs/login.md");
    expect(section).not.toContain("### conform");
    expect(section).not.toContain("bdk evidence record");
    expect(section).toContain("run the `git` command it printed, exactly as printed");
    expect(section.indexOf("### tests-scoped")).toBeLessThan(section.indexOf("### lint"));
  });

  it("leaves a committed task out of the calls and marks it in the Tasks section", async () => {
    const h = dispatchHarness();
    committed(h);
    const { body } = await built(h);
    expect(body).toContain(
      "- `02-1` Store the token (committed). Files: `src/auth/store.ts`. Depends on: none.",
    );
    expect(body).toContain(
      "- `02-3` Verify the link (open). Files: `src/auth/verify.ts`, `src/auth/verify.test.ts`. Depends on: none.",
    );
    const section = checks(body);
    expect(section).not.toContain("bdk check run 02-1");
    expect(section).toContain(`- \`bdk check run 02-3 --ticket ${TICKET}\``);
  });

  it("uses the scoped form, else the command, of a fast test entry", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: pytest\n      scoped: pytest {files}\n    - id: doc\n      tier: fast\n      command: pytest --doctest-modules\n",
    );
    const section = checks((await built(h)).body);
    expect(section).toContain("- `unit`: `pytest {files}`");
    expect(section).toContain("- `doc`: `pytest --doctest-modules`");
  });

  it("says check run records a kind without a command as not-run", async () => {
    const section = checks((await built(dispatchHarness())).body);
    expect(section).toMatch(
      /### lint\n\nNo command is configured for `lint`: `bdk check run` records it `not-run`/,
    );
  });

  it("leaves out the step of a group declared none (T49)", async () => {
    const h = dispatchHarness();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      TOOLS.replace(/ {2}lint:\n[\s\S]*$/, "  lint: none\n"),
    );
    const section = checks((await built(h)).body);
    expect(section).toContain("### tests-scoped");
    expect(section).not.toContain("### lint");
    expect(section).not.toContain("eslint");
  });

  it("follows the order of the step nodes in the pipeline, a project kind included", async () => {
    const store = withDispatchPlugin(repository());
    const path = `${PLUGIN}/pipeline/pipeline.yaml`;
    const pipeline = (store.read(path) ?? "")
      .replace(/\n {2}- id: tests-scoped\n( {4}.*\n)+/, "\n")
      .replace(
        /(\n {2}- id: lint\n( {4}.*\n)+)/,
        "$1  - id: contract-snapshot\n    kind: contract-snapshot\n    stage: execute\n    requires: [conform]\n  - id: tests-scoped\n    kind: tests-scoped\n    stage: execute\n    requires: [conform]\n",
      );
    store.write(path, pipeline);
    const snapshot = new PostTaskStepKind(
      "contract-snapshot",
      "bdk evidence record contract-snapshot <file> --ticket <ticket>",
      "runner",
    );
    const h = dispatchHarness(store, kindRegistry([snapshot]));
    const section = checks((await built(h)).body);
    const at = (kind: string) => section.indexOf(`### ${kind}\n`);
    expect(at("lint")).toBeGreaterThan(-1);
    expect(at("lint")).toBeLessThan(at("tests-scoped"));
  });

  it("is absent from a verifier's package, and so is the Tasks section", async () => {
    const h = dispatchHarness();
    ticket(h.store, { target: "plan-verify", loop: "verifier", id: "A-v3r1f7y2" });
    const { body } = await built(h, "plan-verify", "verifier", "A-v3r1f7y2");
    expect(body).not.toContain("## Checks");
    expect(body).not.toContain("## Tasks");
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

describe("the craft section (T42, R-8)", () => {
  const CACHE = "/home/dev/.claude/plugins/cache/bdk/bdk-craft/0.1.0/skills";
  const craft = (store: Store, ...names: string[]) => {
    for (const name of names) {
      store.write(
        `${CACHE}/${name}/SKILL.md`,
        `---\nname: ${name}\ndescription: x\n---\n\nBody.\n`,
      );
    }
  };
  const section = (body: string) => /\n## Craft\n[\s\S]*?(?=\n## )/.exec(body)?.[0] ?? "";

  it("names tdd and its command for an implementer when bdk-craft is installed", async () => {
    const h = dispatchHarness();
    craft(h.store, "tdd", "debugging");
    const { body } = await built(h);
    const text = section(body);
    expect(text).toContain("`bdk ctx craft tdd`");
    expect(text).not.toContain("debugging");
    expect(text).not.toContain("/home/dev");
    expect(headings(body).indexOf("## Craft")).toBeLessThan(
      headings(body).indexOf("## Ledger entries"),
    );
  });

  it("names debugging, then tdd, on a bug Change", async () => {
    const h = dispatchHarness();
    setChange(h.store, { kind: "bug" });
    craft(h.store, "tdd", "debugging");
    const text = section((await built(h)).body);
    expect(text.indexOf("`bdk ctx craft debugging`")).toBeGreaterThan(0);
    expect(text.indexOf("`bdk ctx craft tdd`")).toBeGreaterThan(text.indexOf("debugging"));
  });

  it("leaves out a craft skill that is not installed", async () => {
    const h = dispatchHarness();
    setChange(h.store, { kind: "bug" });
    craft(h.store, "tdd");
    const text = section((await built(h)).body);
    expect(text).toContain("`bdk ctx craft tdd`");
    expect(text).not.toContain("debugging");
  });

  it("has no craft section without bdk-craft", async () => {
    const { body } = await built(dispatchHarness());
    expect(body).not.toContain("## Craft");
  });

  it.each(["conformer", "reviewer"])("gives a %s package no craft section", async (role) => {
    const h = dispatchHarness();
    craft(h.store, "tdd", "debugging");
    const { body } = await built(h, "02", role, TICKET);
    expect(body).not.toContain("## Craft");
  });
});
