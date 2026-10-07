// `bdk review render` through the real registry on an in-memory repository
// (`kernel-cli/review`; T42-H, J): the inputs the use case gathers - the range
// from git, the plan parts, the ledger with bodies, the integration
// reviewer's areas, the gate evidence, the settings - and the `--pr` refusals.
import { describe, expect, it } from "vitest";

import { writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import {
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  logDeps,
  repository,
  ROOT,
  runBdk,
} from "../../log/tests/support.ts";
import { reviewRegistrations } from "../index.ts";
import { reviewRenderOutput } from "../schema/render.ts";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const FIRST = "1".repeat(40);
const SECOND = "2".repeat(40);
const NUMSTAT = "30\t4\tsrc/auth/login.ts\0" + "2\t0\tREADME.md\0" + "1\t1\t.bdk/changes/x.md\0";
const LOG = `\x1e${FIRST}\x1ffeat: issue the link\0\nsrc/auth/login.ts\0\x1e${SECOND}\x1fdocs: readme\0\nREADME.md\0src/auth/login.ts\0`;

function git(options: { head?: boolean } = {}) {
  const base = fakeGit();
  const calls: string[][] = [];
  return {
    calls,
    base,
    git: {
      ...base,
      run: (args: readonly string[], cwd: string) => {
        calls.push([...args]);
        const answer = (stdout: string) => Promise.resolve({ code: 0, stdout, stderr: "" });
        if (args[0] === "rev-parse" && args.includes("HEAD")) {
          return options.head === false
            ? Promise.resolve({ code: 1, stdout: "", stderr: "" })
            : answer(`${HEAD}\n`);
        }
        if (args[0] === "diff" && args.includes("--numstat")) return answer(NUMSTAT);
        if (args[0] === "log" && args.includes("--reverse")) return answer(LOG);
        return base.run(args, cwd);
      },
    },
  };
}

function seeded(): Store {
  const store = repository();
  writeDocument(store, `${DIR}/change.md`, {
    data: {
      schema: 1,
      id: CHANGE,
      kind: "feature",
      profile: "small",
      intent: "Users log in with a one-time link.",
      source: "user",
      at: "2026-09-25T09:00:00.000Z",
      author: AUTHOR,
      overridden: [],
      base: BASE,
    },
    body: "",
  });
  store.write(
    `${DIR}/plan/parts/01-part.md`,
    '---\nschema: 1\nid: "01"\ntitle: Magic link\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n## 01-1 Issue the link\n\n**Files:**\n\n- `src/auth/login.ts`\n\n**Test cases:**\n\n- works\n',
  );
  return store;
}

function entry(store: Store, id: string, fields: Record<string, unknown>, body = ""): void {
  writeDocument(store, `${DIR}/log/20260925T100000Z-${String(fields.type)}-${id}.md`, {
    data: {
      schema: 1,
      id,
      summary: `entry ${id}`,
      status: "proposed",
      source: "agent:reviewer",
      author: AUTHOR,
      at: "2026-09-25T10:00:00.000Z",
      refs: ["src/auth/login.ts"],
      ...fields,
    },
    body,
  });
}

function attempt(store: Store, ticket: string, at: string): void {
  writeDocument(store, `${DIR}/attempts/review-fix-${CHANGE}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop: "review-fix",
      target: CHANGE,
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": at,
      "closed-at": at,
      outcome: "fail",
      author: AUTHOR,
    },
    body: "",
  });
}

function report(store: Store, ticket: string, role: string, areas: string, more = ""): void {
  writeDocument(store, `${DIR}/reports/${CHANGE}-${role}-${ticket}-integration.md`, {
    data: {
      schema: 1,
      ticket,
      role,
      group: "integration",
      status: "done",
      files: [],
      entries: [],
      evidence: [],
    },
    body: `# Integration review\n\n${more}## Areas\n\n${areas}\n`,
  });
}

function manifest(store: Store, id: string, kind: string, fields: Record<string, unknown> = {}) {
  writeDocument(store, `${DIR}/evidence/${CHANGE}-${id}.md`, {
    data: {
      schema: 1,
      id,
      kind,
      ticket: "A-00000001",
      target: CHANGE,
      at: `2026-09-25T1${id.slice(-1)}:00:00.000Z`,
      author: AUTHOR,
      source: "agent:runner",
      "tree-hash": `sha256:${"c".repeat(64)}`,
      tree: [],
      files: [
        {
          path: `.bdk/.machine/evidence/${id}.json`,
          hash: `sha256:${"d".repeat(64)}`,
          stored: "machine",
        },
      ],
      verdict: "pass",
      ...fields,
    },
    body: "",
  });
}

async function render(store: Store, g = git().git, argv: string[] = [], stdin = "") {
  return runBdk(
    reviewRegistrations(logDeps(store, g)),
    store,
    g,
    ["review", "render", ...argv, "--json"],
    stdin,
  );
}

describe("review render", () => {
  it("renders the Change report from git, the plan, the ledger, the areas and the gate", async () => {
    const store = seeded();
    store.write(
      `${ROOT}/.bdk/settings.yaml`,
      'tracker: {kind: github}\nreview:\n  risks:\n    - {id: core, instruction: "Core", paths: ["src/**"]}\ntools:\n  test:\n    - {id: unit, command: "pnpm test", tier: fast, coverage: {command: "pnpm cov", report: cov.info, format: lcov, min: 80}}\n',
    );
    entry(
      store,
      "L-00000001",
      { type: "finding", level: "should-fix" },
      "Problem: p\n\nWhy it matters: w\n\nSuggested fix: f",
    );
    entry(store, "L-00000002", {
      type: "observation",
      level: "nice-to-have",
      disposition: "track",
      issue: "PAY-1",
      status: "accepted",
    });
    entry(
      store,
      "L-00000003",
      { type: "finding", status: "resolved" },
      "Resolved as resolved at 2026-09-25T11:00:00Z: fixed",
    );
    attempt(store, "A-00000002", "2026-09-25T12:00:00.000Z");
    attempt(store, "A-00000001", "2026-09-25T11:00:00.000Z");
    report(store, "A-00000002", "integration-reviewer", "- core: Second round.");
    report(
      store,
      "A-00000001",
      "integration-reviewer",
      "- core: First round.\n- unplanned: The README.",
    );
    report(store, "A-00000003", "reviewer", "- core: Not the integration reviewer.");
    manifest(store, "E-00000001", "tests-full");
    manifest(store, "E-00000002", "lint-full", { verdict: "fail" });
    manifest(store, "E-00000003", "coverage", { tool: "unit" });
    store.write(`${ROOT}/.bdk/.machine/evidence/E-00000003.json`, '{"percent": 91.5}\n');
    const { git: g, calls } = git();

    const result = await render(store, g);
    expect(result.code, result.stdout).toBe(0);
    expect(reviewRenderOutput.parse(result.json)).toStrictEqual({
      change: CHANGE,
      format: "html",
      path: `.bdk/.machine/review/${CHANGE}.html`,
      range: `${BASE}..${HEAD}`,
      undecided: ["L-00000001"],
      decided: ["L-00000002"],
      tracker: "github",
    });
    expect(calls).toContainEqual(expect.arrayContaining([`${BASE}..${HEAD}`]));
    const page = store.read(`${ROOT}/.bdk/.machine/review/${CHANGE}.html`) ?? "";
    expect(page).toContain("<p>Second round.</p>");
    expect(page).toContain("<p>The README.</p>");
    expect(page).not.toContain("Not the integration reviewer");
    expect(page).toContain("Task <code>01-1</code> Issue the link");
    expect(page).toContain("<code>1111111</code> feat: issue the link");
    expect(page).toContain("<code>2222222</code> docs: readme");
    expect(page).not.toContain(".bdk/changes/x.md");
    expect(page).toContain("<dt>Why it matters</dt><dd>w</dd>");
    expect(page).toContain("issue PAY-1");
    expect(page).toContain('value="track"');
    expect(page).toContain("91.5% (min 80%)");
    expect(page).toContain('<span class="verdict fail">fail</span>');
    expect(page).toContain("(fixed)");
  });

  it("traces the scenarios of the spec deltas through the latest Intent table (#158)", async () => {
    const store = seeded();
    store.write(
      `${DIR}/spec-delta/auth/login.md`,
      "## ADDED Requirements\n\n### Requirement: Magic link\n\nThe system SHALL send a link.\n\n#### Scenario: link sent\n\n- **WHEN** x\n- **THEN** y\n\n#### Scenario: link expired\n\n- **WHEN** x\n- **THEN** y\n\n## REMOVED Requirements\n\n### Requirement: Password login\n\n**Reason**: links replace it.\n",
    );
    const table = (state: string) =>
      `## Intent\n\n| Capability | Requirement | Scenario | Code | Test | State |\n|---|---|---|---|---|---|\n| auth/login | Magic link | link sent | login.ts | login.test.ts | ${state} |\n| auth/login | Password login | - | login.ts | - | ok |\n\n`;
    attempt(store, "A-00000001", "2026-09-25T11:00:00.000Z");
    attempt(store, "A-00000002", "2026-09-25T12:00:00.000Z");
    attempt(store, "A-00000003", "2026-09-25T13:00:00.000Z");
    report(store, "A-00000001", "integration-reviewer", "- core: First.", table("L-00000009"));
    report(store, "A-00000002", "integration-reviewer", "- core: Second.", table("ok"));
    report(store, "A-00000003", "integration-reviewer", "- core: Third, no table.");

    const result = await render(store, git().git, ["--format", "md", "--out", "review.md"]);
    expect(result.code, result.stdout).toBe(0);
    const md = store.read(`${ROOT}/review.md`) ?? "";
    expect(md).toContain(
      "| `auth/login` | Magic link | link sent | login.ts | login.test.ts | ok |\n| `auth/login` | Magic link | link expired |  |  | untraced |\n| `auth/login` | Password login | - | login.ts | - | ok |",
    );
    expect(md).not.toContain("No integration-reviewer report holds");
  });

  it("warns when no integration report holds an Intent table, and shows none without a delta (#158)", async () => {
    const store = seeded();
    report(store, "A-00000001", "integration-reviewer", "- core: First.");
    const before = await render(store, git().git, ["--format", "md", "--out", "review.md"]);
    expect(before.code, before.stdout).toBe(0);
    expect(store.read(`${ROOT}/review.md`)).not.toContain("## Intent");
    store.write(
      `${DIR}/spec-delta/auth.md`,
      "## ADDED Requirements\n\n### Requirement: Magic link\n\nThe system SHALL send a link.\n\n#### Scenario: link sent\n\n- **WHEN** x\n- **THEN** y\n",
    );
    await render(store, git().git, ["--format", "md", "--out", "review.md"]);
    expect(store.read(`${ROOT}/review.md`)).toContain(
      "No integration-reviewer report holds an `## Intent` table: every scenario is untraced.\n\n| Capability | Requirement | Scenario | Code | Test | State |\n|---|---|---|---|---|---|\n| `auth` | Magic link | link sent |  |  | untraced |",
    );
  });

  it("--format md --out writes Markdown at the path, relative to cwd", async () => {
    const store = seeded();
    const result = await render(store, git().git, ["--format", "md", "--out", "review.md"]);
    expect(result.json).toMatchObject({ format: "md", path: "review.md", tracker: null });
    expect(store.read(`${ROOT}/review.md`)).toMatch(/^# 2026-09-25-login\n/);
  });

  it("renders an empty range without a commit and without a coverage summary", async () => {
    const store = seeded();
    store.write(
      `${ROOT}/.bdk/settings.yaml`,
      'tools:\n  test:\n    - {id: unit, command: "pnpm test", tier: fast, coverage: {command: "pnpm cov", report: cov.info, format: lcov}}\n',
    );
    manifest(store, "E-00000003", "coverage", { tool: "unit" });
    const result = await render(store, git({ head: false }).git);
    expect(result.code, result.stdout).toBe(0);
    const page = store.read(`${ROOT}/.bdk/.machine/review/${CHANGE}.html`) ?? "";
    expect(page).toContain("Coverage <code>unit</code>: n/a");
    expect(page).toContain('<span class="muted">not recorded</span>');
  });

  it("reads --pr from a file relative to cwd", async () => {
    const store = seeded();
    store.write(
      `${ROOT}/prs.json`,
      JSON.stringify({ prs: [{ number: 7, url: "javascript:x", title: "T", findings: [] }] }),
    );
    const result = await render(store, git().git, [
      "--pr",
      "prs.json",
      "--out",
      "/tmp/pr.md",
      "--format",
      "md",
    ]);
    expect(result.json).toMatchObject({ change: null, path: "/tmp/pr.md", undecided: [] });
    expect(store.read("/tmp/pr.md")).toContain("## #7 T");
  });

  it.each([
    [["--pr", "-"], "{}", 3, "input/missing-argument"],
    [["--pr", "missing.json", "--out", "x.html"], "", 3, "input/not-found"],
    [["--pr", "-", "--out", "x.html"], "not json", 3, "input/invalid-argument"],
    [["--pr", "-", "--out", "x.html"], '{"prs": [{"number": "x"}]}', 3, "input/invalid-argument"],
    [["--pr", "-", "--out", "x.html"], "[]", 3, "input/invalid-argument"],
  ])("refuses %j with %s", async (argv, stdin, code, rule) => {
    const result = await render(seeded(), git().git, argv, stdin);
    expect(result.code).toBe(code);
    expect(result.json).toMatchObject({ rule });
  });

  it("names the first wrong field of --pr input", async () => {
    const result = await render(
      seeded(),
      git().git,
      ["--pr", "-", "--out", "x.html"],
      '{"prs": [{"number": "x"}]}',
    );
    expect((result.json as { why: string }).why).toMatch(/^--pr input: prs\[0\]\.number: /);
  });

  it("refuses a Change report without an active Change", async () => {
    const store = seeded();
    const { git: g, base } = git();
    base.branch = "other";
    const result = await render(store, g);
    expect(result.json).toMatchObject({ rule: "policy/no-active-change" });
  });
});
