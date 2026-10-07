// The view model of the human review report (`kernel-cli/review`, bdk review
// render; T42-H): parts against modules, risk cards with their area summary,
// tasks and commits per file, the gate, the Decisions groups, Settled and
// Context, from one fixed input.
import { describe, expect, it } from "vitest";

import { areaLines, changeReport, intentRows, splitBody } from "../domain/report.ts";
import { fixture } from "./report-fixture.ts";

describe("changeReport", () => {
  const report = changeReport(fixture());

  it("sums the range and counts the open entries per level and disposition", () => {
    expect(report.totals).toStrictEqual({ files: 4, added: 84, removed: 5 });
    expect(report.levels).toMatchObject({
      blocker: 1,
      "should-fix": 1,
      "nice-to-have": 1,
      untriaged: 1,
    });
    expect(report.dispositions).toMatchObject({ defer: 1, none: 3 });
  });

  it("puts the parts against the modules, with a row outside the plan", () => {
    expect(report.grid.modules).toStrictEqual(["README.md", "src/auth", "src/mail"]);
    expect(report.grid.rows.map((row) => row.label)).toStrictEqual([
      "01 Magic link",
      "02 Mail",
      "outside the plan",
    ]);
    const [first, , outside] = report.grid.rows;
    expect(first?.cells[1]).toStrictEqual({
      files: ["src/auth/login.test.ts", "src/auth/login.ts"],
      added: 70,
      removed: 4,
      weight: 4,
    });
    expect(first?.cells[0]).toBeUndefined();
    expect(outside?.cells[0]).toMatchObject({ files: ["README.md"], weight: 1 });
  });

  it("shows the modules only without plan parts", () => {
    const rows = changeReport(fixture({ parts: [] })).grid.rows;
    expect(rows.map((row) => row.label)).toStrictEqual(["changed files"]);
  });

  it("opens a card per matched risk and per summary line, then the files outside the plan", () => {
    expect(report.cards.map((card) => [card.id, card.summary])).toStrictEqual([
      ["auth", "Login gains a magic link path; password login is unchanged."],
      ["public-api", "The login endpoint accepts a link token."],
      ["unplanned", "The README documents the new flow."],
    ]);
    expect(report.cards[1]?.files).toStrictEqual([]);
  });

  it("gives each file its tasks, its commits oldest first and its tags", () => {
    const login = report.cards[0]?.files.find((file) => file.path === "src/auth/login.ts");
    expect(login?.tasks).toStrictEqual([{ id: "01-1", title: "Issue the link" }]);
    expect(login?.commits.map((commit) => commit.subject)).toStrictEqual([
      "feat: issue the link",
      "fix: hash the token",
    ]);
    expect(login?.tags).toStrictEqual([
      { id: "L-00000002", level: "should-fix", disposition: undefined },
      { id: "L-00000003", level: "nice-to-have", disposition: "defer" },
    ]);
    const readme = report.cards[2]?.files[0];
    expect(readme).toMatchObject({ path: "README.md", tasks: [], commits: [] });
    expect(readme?.tags.map((tag) => tag.id)).toStrictEqual(["L-00000005"]);
  });

  it("opens a card without a summary when no area line names the risk", () => {
    const cards = changeReport(fixture({ areas: new Map() })).cards;
    expect(cards.map((card) => [card.id, card.summary])).toStrictEqual([
      ["auth", undefined],
      ["unplanned", undefined],
    ]);
  });

  it("carries the gate verdicts and coverage", () => {
    expect(report.gate).toStrictEqual(fixture().gate);
  });

  it("groups Decisions by level, leaving blocker-level entries out", () => {
    expect(
      report.decisions.map((group) => [group.group, group.entries.map((item) => item.id)]),
    ).toStrictEqual([
      ["should-fix", ["L-00000002"]],
      ["nice-to-have", ["L-00000003"]],
      ["untriaged", ["L-00000005"]],
    ]);
    const finding = report.decisions[0]?.entries[0];
    expect(finding).toMatchObject({
      writer: "agent:reviewer",
      severity: "high",
      category: "security",
      review: false,
      body: {
        kind: "labelled",
        problem: "The token is compared with ==.",
        why: "A timing attack reveals it.",
        fix: "Use timingSafeEqual.",
      },
      history: ["Triaged as should-fix at 2026-09-25T10:00:00Z: real"],
      reason: "real",
    });
    expect(report.decisions[1]?.entries[0]?.body).toStrictEqual({
      kind: "text",
      text: "Dates are built by hand.",
    });
  });

  it("lists resolved entries under Settled with their reason", () => {
    expect(report.settled).toStrictEqual([
      { id: "L-00000006", type: "finding", summary: "finding L-00000006", reason: "fixed in 01-1" },
    ]);
  });

  it("lists live decisions, assumptions and risks under Context", () => {
    expect(report.context.map((item) => item.id)).toStrictEqual(["L-00000001", "L-00000007"]);
  });
});

describe("splitBody", () => {
  it("reads Failure scenario as a fourth field after Problem (#158)", () => {
    const body = [
      "Problem: parse reads a null body.",
      "Failure scenario: a 204 reply makes parse throw.",
      "Why it matters: the page shows no error.",
      "Suggested fix: return early on an empty body.",
      "Triaged as should-fix at 2026-10-07T10:00:00Z: the null body reaches parse",
    ].join("\n\n");
    expect(splitBody(body)).toStrictEqual({
      body: {
        kind: "labelled",
        problem: "parse reads a null body.",
        failure: "a 204 reply makes parse throw.",
        why: "the page shows no error.",
        fix: "return early on an empty body.",
      },
      history: [
        {
          line: "Triaged as should-fix at 2026-10-07T10:00:00Z: the null body reaches parse",
          reason: "the null body reaches parse",
        },
      ],
    });
  });

  it("drops no paragraph of a labelled body: an unlabelled one continues the field above it", () => {
    const body =
      "Problem: two callers.\n\nThe second one is in auth.\n\nWhy it matters: x\n\nSuggested fix: y\n\n```ts\nguard();\n```";
    expect(splitBody(body).body).toStrictEqual({
      kind: "labelled",
      problem: "two callers.\n\nThe second one is in auth.",
      why: "x",
      fix: "y\n\n```ts\nguard();\n```",
    });
  });

  it("keeps a body with text before its first label as written", () => {
    expect(
      splitBody("Intro.\n\nProblem: a\n\nWhy it matters: b\n\nSuggested fix: c").body,
    ).toStrictEqual({
      kind: "text",
      text: "Intro.\n\nProblem: a\n\nWhy it matters: b\n\nSuggested fix: c",
    });
  });

  it("keeps a body without all three labels as written", () => {
    expect(splitBody("Problem: half a label.\n\nMore text.").body).toStrictEqual({
      kind: "text",
      text: "Problem: half a label.\n\nMore text.",
    });
  });
});

describe("intentRows (#158)", () => {
  const table = (...rows: string[]) =>
    [
      "# Integration review",
      "",
      "## Intent",
      "",
      "| Capability | Requirement | Scenario | Code | Test | State |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
      "## Areas",
      "",
      "- auth: x",
    ].join("\n");

  it("reads the rows by capability, requirement and scenario, names trimmed", () => {
    const body = table(
      "|  api-errors | Problem details body  |  gateway body | `src/api/http.ts` | `http.test.ts` | ok |",
      "| api-errors | Problem details body | body that is not JSON | src/api/http.ts | - | L-a1b2c3d4, L-e5f6g7h8 |",
    );
    expect(intentRows(body)).toStrictEqual([
      {
        capability: "api-errors",
        requirement: "Problem details body",
        scenario: "gateway body",
        code: "`src/api/http.ts`",
        test: "`http.test.ts`",
        state: { kind: "ok" },
      },
      {
        capability: "api-errors",
        requirement: "Problem details body",
        scenario: "body that is not JSON",
        code: "src/api/http.ts",
        test: "-",
        state: { kind: "entries", ids: ["L-a1b2c3d4", "L-e5f6g7h8"] },
      },
    ]);
  });

  it("skips a malformed row: a wrong cell count or a state that is neither ok nor entry ids", () => {
    const body = table(
      "| api-errors | Problem details body | gateway body | x |",
      "| api-errors | Problem details body | problem body | x | y | maybe |",
      "| api-errors | Problem details body | blank body | x | y | ok |",
    );
    expect(intentRows(body)?.map((row) => row.scenario)).toStrictEqual(["blank body"]);
  });

  it("is undefined without an Intent table and empty for a table without rows", () => {
    expect(intentRows("# Review\n\n## Areas\n\n- auth: x\n")).toBeUndefined();
    expect(intentRows("## Intent\n\nNo table here.\n")).toBeUndefined();
    expect(intentRows(table())).toStrictEqual([]);
  });

  it("matches names exactly after trimming: case and inner spaces count", () => {
    const [row] =
      intentRows(table("| API-errors | Problem  details body | Gateway Body | a | b | ok |")) ?? [];
    expect(row).toMatchObject({
      capability: "API-errors",
      requirement: "Problem  details body",
      scenario: "Gateway Body",
    });
  });
});

describe("areaLines", () => {
  it("reads the lines under ## Areas only, a later line winning, cut at 300 characters", () => {
    const body = [
      "# Integration review",
      "- auth: not an area line",
      "## Areas",
      "- auth: First.",
      "- public-api: The endpoint changes.",
      `- auth: ${"x".repeat(400)}`,
      "## Next",
      "- migration: outside",
    ].join("\n");
    const areas = areaLines(body);
    expect([...areas.keys()]).toStrictEqual(["auth", "public-api"]);
    expect(areas.get("auth")).toHaveLength(300);
  });
});
