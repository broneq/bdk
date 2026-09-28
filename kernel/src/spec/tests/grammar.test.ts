// The delta and living spec grammar (`kernel-state`, Spec delta and Living
// spec file): sections, requirement blocks, scenarios, removals, line numbers,
// canonical rendering and the body hash.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { blockText, hasBullet, parseDelta, statement } from "../domain/grammar.ts";
import { bodyHash, livingOf, renderLiving } from "../use-cases/living.ts";

/** The item, failing the test when there is none. */
function the<T>(item: T | undefined): T {
  if (item === undefined) throw new Error("expected an item");
  return item;
}

const DELTA = [
  "# Delta for auth/login",
  "",
  "## Purpose",
  "",
  "Signing in without a password, through a link sent by e-mail to the user.",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: Magic link sent",
  "",
  "The system SHALL send a link.   ",
  "",
  "#### Scenario: known address",
  "",
  "- **WHEN** a known address asks",
  "- **THEN** a link is sent",
  "",
  "#### Scenario: unknown address",
  "",
  "- **WHEN** an unknown address asks",
  "- **THEN** nothing is sent",
  "",
  "## MODIFIED Requirements",
  "",
  "### Requirement: Magic link expires",
  "",
  "A link SHALL expire.",
  "",
  "```text",
  "## not a section",
  "#### Scenario: not a scenario",
  "```",
  "",
  "#### Scenario: expired link",
  "",
  "- **GIVEN** a link",
  "- **WHEN** it is 16 minutes old",
  "- **THEN** it is refused",
  "",
  "## REMOVED Requirements",
  "",
  "### Requirement: Legacy login",
  "",
  "**Reason**: replaced",
  "",
  "### Requirement: Magic link expires",
  "",
  "#### Scenario: reused link",
  "",
].join("\n");

describe("parseDelta", () => {
  const delta = parseDelta(DELTA);

  it("reads the purpose and its line, ignoring the title", () => {
    expect(delta.purpose).toStrictEqual({
      text: "Signing in without a password, through a link sent by e-mail to the user.",
      line: 3,
    });
  });

  it("reads added requirements with their scenarios and lines", () => {
    expect(delta.added.map((requirement) => [requirement.name, requirement.line])).toStrictEqual([
      ["Magic link sent", 9],
    ]);
    const [sent] = delta.added;
    expect(sent?.scenarios.map((scenario) => [scenario.name, scenario.line])).toStrictEqual([
      ["known address", 13],
      ["unknown address", 18],
    ]);
    expect(statement(the(sent))).toBe("The system SHALL send a link.");
  });

  it("ignores headings inside a code fence", () => {
    const [expires] = delta.modified;
    expect(expires?.scenarios.map((scenario) => scenario.name)).toStrictEqual(["expired link"]);
    expect(statement(the(expires))).toContain("## not a section");
    expect(delta.problems).toStrictEqual([]);
  });

  it("finds the WHEN and THEN bullets, GIVEN being free", () => {
    const scenario = delta.modified[0]?.scenarios[0];
    expect(hasBullet(the(scenario), "WHEN")).toBe(true);
    expect(hasBullet(the(scenario), "THEN")).toBe(true);
  });

  it("reads a whole removal and a removal of listed scenarios", () => {
    expect(
      delta.removed.map((removal) => ({
        name: removal.name,
        line: removal.line,
        scenarios: removal.scenarios,
      })),
    ).toStrictEqual([
      { name: "Legacy login", line: 42, scenarios: [] },
      { name: "Magic link expires", line: 46, scenarios: [{ name: "reused link", line: 48 }] },
    ]);
  });

  it("renders a block canonically, trailing whitespace trimmed", () => {
    expect(blockText(the(delta.added[0]))).toBe(
      [
        "### Requirement: Magic link sent",
        "",
        "The system SHALL send a link.",
        "",
        "#### Scenario: known address",
        "",
        "- **WHEN** a known address asks",
        "- **THEN** a link is sent",
        "",
        "#### Scenario: unknown address",
        "",
        "- **WHEN** an unknown address asks",
        "- **THEN** nothing is sent",
      ].join("\n"),
    );
  });

  it("reports a malformed scenario heading and an unknown section with their lines", () => {
    const parsed = parseDelta(
      [
        "## ADDED Requirements",
        "",
        "### Requirement: A",
        "",
        "It SHALL work.",
        "",
        "### Scenario: three hashes",
        "- **Scenario:** bold bullet",
        "#### scenario: lower case",
        "",
        "## RENAMED Requirements",
        "",
      ].join("\n"),
    );
    expect(parsed.problems.map((problem) => [problem.line, problem.code])).toStrictEqual([
      [7, "scenario-prefix"],
      [8, "scenario-prefix"],
      [9, "scenario-prefix"],
      [11, "section-unknown"],
    ]);
  });

  it("reads CRLF line endings as LF", () => {
    const parsed = parseDelta(DELTA.replaceAll("\n", "\r\n"));
    expect(blockText(the(parsed.added[0]))).toBe(blockText(the(delta.added[0])));
  });

  it("reports a section given twice", () => {
    const parsed = parseDelta("## Purpose\n\nOne.\n\n## Purpose\n\nTwo.\n");
    expect(parsed.problems.map((problem) => [problem.line, problem.code])).toStrictEqual([
      [5, "section-unknown"],
    ]);
  });
});

describe("living spec", () => {
  const requirements = parseDelta(DELTA).added;
  const purpose = "Signing in without a password, through a link sent by e-mail.";

  it("renders the canonical body with the merge hash and the Change", () => {
    const { text, hash } = renderLiving("auth/login", { purpose, requirements }, "2026-09-25-x");
    const body = [
      "# auth/login Specification",
      "",
      "## Purpose",
      "",
      purpose,
      "",
      "## Requirements",
      "",
      blockText(the(requirements[0])),
      "",
    ].join("\n");
    expect(hash).toBe(`sha256:${createHash("sha256").update(body).digest("hex")}`);
    expect(text).toBe(`---\nbdk-merge-hash: ${hash}\nbdk-change: 2026-09-25-x\n---\n${body}`);
    expect(bodyHash(body)).toBe(hash);
  });

  it("parses what it renders back to the same bytes", () => {
    const { text } = renderLiving("auth/login", { purpose, requirements }, "2026-09-25-x");
    const living = livingOf(text);
    expect(living.purpose).toBe(purpose);
    expect(living.change).toBe("2026-09-25-x");
    expect(living.hash).toBe(bodyHash(living.body));
    expect(living.requirements.map((requirement) => requirement.name)).toStrictEqual([
      "Magic link sent",
    ]);
    expect(renderLiving("auth/login", living, "2026-09-25-x").text).toBe(text);
  });

  it("parses a file without frontmatter with no hash", () => {
    const living = livingOf("# a Specification\n\n## Purpose\n\nP.\n\n## Requirements\n");
    expect(living.hash).toBeUndefined();
    expect(living.change).toBeUndefined();
    expect(living.requirements).toStrictEqual([]);
  });
});
