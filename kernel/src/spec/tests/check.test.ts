// Every problem code of `spec delta check` (`kernel-cli/spec`), on the pure
// check over a parsed delta and the current living spec.
import { describe, expect, it } from "vitest";

import { checkDelta } from "../domain/check.ts";
import { parseDelta } from "../domain/grammar.ts";
import { livingOf, renderLiving } from "../use-cases/living.ts";
import { mergeDelta } from "../domain/merge.ts";

const ID = "2026-09-25-passwordless-login";
const PURPOSE = "Signing in without a password, through a link sent by e-mail.";

/** `### Requirement:` block text with a statement and scenarios given as [name, WHEN?, THEN?]. */
function block(name: string, scenarios: readonly string[], word = "SHALL"): string {
  return [
    `### Requirement: ${name}`,
    "",
    `The system ${word} do ${name.toLowerCase()}.`,
    "",
    ...scenarios.flatMap((scenario) => [
      `#### Scenario: ${scenario}`,
      "",
      `- **WHEN** ${scenario} happens`,
      `- **THEN** it is handled`,
      "",
    ]),
  ].join("\n");
}

function living(
  requirements: Readonly<Record<string, readonly string[]>>,
  change = "2026-09-01-earlier",
) {
  const delta = parseDelta(
    `## ADDED Requirements\n\n${Object.entries(requirements)
      .map(([name, scenarios]) => block(name, scenarios))
      .join("\n")}`,
  );
  return livingOf(
    renderLiving("auth/login", { purpose: PURPOSE, requirements: delta.added }, change).text,
  );
}

const CURRENT = living({ "Magic link expires": ["expired link", "reused link"] });

/** `current: null` checks a delta that creates the capability. */
function problems(
  text: string,
  current: ReturnType<typeof living> | null = CURRENT,
  word = "SHALL",
) {
  return checkDelta({
    delta: parseDelta(text),
    current: current ?? undefined,
    changeId: ID,
    word,
  }).map((problem) => [problem.line, problem.code]);
}

function messages(text: string) {
  return checkDelta({ delta: parseDelta(text), current: CURRENT, changeId: ID, word: "SHALL" }).map(
    (problem) => problem.message,
  );
}

describe("checkDelta", () => {
  it("passes a valid delta", () => {
    expect(problems(`## ADDED Requirements\n\n${block("Link sent", ["sent"])}`)).toStrictEqual([]);
  });

  it("when-missing: a scenario without a WHEN bullet", () => {
    const text = [
      "## ADDED Requirements",
      "",
      "### Requirement: Link sent",
      "",
      "The system SHALL send.",
      "",
      "#### Scenario: sent",
      "",
      "- **THEN** a link is sent",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([[7, "when-missing"]]);
    expect(messages(text)[0]).toContain("sent");
  });

  it("then-missing: a scenario without a THEN bullet", () => {
    const text = [
      "## ADDED Requirements",
      "",
      "### Requirement: Link sent",
      "",
      "The system SHALL send.",
      "",
      "#### Scenario: sent",
      "",
      "- **WHEN** asked",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([[7, "then-missing"]]);
  });

  it("scenario-prefix: from the grammar", () => {
    const text = `## ADDED Requirements\n\n${block("Link sent", ["sent"])}\n### Scenario: bad\n`;
    expect(problems(text)).toContainEqual([12, "scenario-prefix"]);
  });

  it("scenario-missing: an added requirement without a scenario", () => {
    expect(
      problems("## ADDED Requirements\n\n### Requirement: Link sent\n\nThe system SHALL send.\n"),
    ).toStrictEqual([[3, "scenario-missing"]]);
  });

  it("scenario-missing: a removal that leaves the requirement none", () => {
    const text = [
      "## REMOVED Requirements",
      "",
      "### Requirement: Magic link expires",
      "",
      "#### Scenario: expired link",
      "#### Scenario: reused link",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([[3, "scenario-missing"]]);
  });

  it("scenario-lost: MODIFIED drops a scenario REMOVED does not list", () => {
    const text = `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}`;
    expect(problems(text)).toStrictEqual([[3, "scenario-lost"]]);
    expect(messages(text)[0]).toContain("reused link");
  });

  it("removal through REMOVED passes", () => {
    const text = [
      `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}`,
      "## REMOVED Requirements",
      "",
      "### Requirement: Magic link expires",
      "",
      "#### Scenario: reused link",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([]);
  });

  it("normative-word: the configured word, whole and case-sensitive", () => {
    const text = `## ADDED Requirements\n\n${block("Link sent", ["sent"])}`;
    expect(problems(text, CURRENT, "MUST")).toStrictEqual([[3, "normative-word"]]);
    expect(
      problems(`## ADDED Requirements\n\n${block("Link sent", ["sent"], "SHALLOW")}`),
    ).toStrictEqual([[3, "normative-word"]]);
    expect(
      problems(`## ADDED Requirements\n\n${block("Link sent", ["sent"], "shall")}`),
    ).toStrictEqual([[3, "normative-word"]]);
  });

  it("requirement-unknown: MODIFIED and REMOVED name what the spec does not hold", () => {
    const text = [
      `## MODIFIED Requirements\n\n${block("Nothing", ["x"])}`,
      "## REMOVED Requirements",
      "",
      "### Requirement: Absent",
      "",
      "### Requirement: Magic link expires",
      "",
      "#### Scenario: no such scenario",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([
      [3, "requirement-unknown"],
      [14, "requirement-unknown"],
      [18, "requirement-unknown"],
    ]);
  });

  it("requirement-exists: ADDED names a requirement held with another text", () => {
    expect(
      problems(`## ADDED Requirements\n\n${block("Magic link expires", ["expired link"])}`),
    ).toStrictEqual([[3, "requirement-exists"]]);
  });

  it("requirement-duplicate: twice in one section, or in ADDED and MODIFIED", () => {
    const twice = `## ADDED Requirements\n\n${block("Link sent", ["a"])}\n${block("Link sent", ["b"])}`;
    expect(problems(twice)).toStrictEqual([[12, "requirement-duplicate"]]);
    const both = [
      `## ADDED Requirements\n\n${block("Magic link expires", ["expired link", "reused link"])}`,
      `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link", "reused link"])}`,
    ].join("\n");
    expect(problems(both).map(([, code]) => code)).toContain("requirement-duplicate");
  });

  it("section-unknown: from the grammar", () => {
    expect(
      problems(`## RENAMED Requirements\n\n## ADDED Requirements\n\n${block("A", ["a"])}`),
    ).toStrictEqual([[1, "section-unknown"]]);
  });

  it("purpose-missing: a new capability without a purpose of 50 characters", () => {
    const added = `## ADDED Requirements\n\n${block("Link sent", ["sent"])}`;
    expect(problems(added, null)).toStrictEqual([[1, "purpose-missing"]]);
    expect(problems(`## Purpose\n\nToo short.\n\n${added}`, null)).toStrictEqual([
      [1, "purpose-missing"],
    ]);
    expect(problems(`## Purpose\n\n${PURPOSE}\n\n${added}`, null)).toStrictEqual([]);
  });

  it("delta-empty: no requirement and no purpose", () => {
    expect(problems("# Title only\n")).toStrictEqual([[1, "delta-empty"]]);
  });

  it("still passes after a merge by the same Change", () => {
    const text = [
      `## ADDED Requirements\n\n${block("Link sent", ["sent"])}`,
      `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}`,
      "## REMOVED Requirements",
      "",
      "### Requirement: Magic link expires",
      "",
      "#### Scenario: reused link",
      "",
    ].join("\n");
    expect(problems(text)).toStrictEqual([]);
    const merged = mergeDelta(CURRENT, parseDelta(text));
    const after = livingOf(renderLiving("auth/login", merged, ID).text);
    expect(problems(text, after)).toStrictEqual([]);
  });

  it("a whole removal already merged by the same Change is not unknown", () => {
    const text = "## REMOVED Requirements\n\n### Requirement: Magic link expires\n";
    const after = living({ "Other thing": ["x"] }, ID);
    expect(problems(text, after)).toStrictEqual([]);
    expect(problems(text, living({ "Other thing": ["x"] }))).toStrictEqual([
      [3, "requirement-unknown"],
    ]);
  });
});
