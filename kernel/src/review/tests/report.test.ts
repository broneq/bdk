// The view model of the human review report (`kernel-cli/review`, bdk review
// render; T42-H): parts against modules, risk cards with their area summary,
// tasks and commits per file, the gate, the Decisions groups, Settled and
// Context, from one fixed input.
import { describe, expect, it } from "vitest";

import { areaLines, changeReport, splitBody } from "../domain/report.ts";
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
  it("keeps a body without all three labels as written", () => {
    expect(splitBody("Problem: half a label.\n\nMore text.").body).toStrictEqual({
      kind: "text",
      text: "Problem: half a label.\n\nMore text.",
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
