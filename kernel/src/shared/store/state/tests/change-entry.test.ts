import { describe, expect, it } from "vitest";

import { changeKind } from "../change.ts";
import { ENTRY_TYPES, entryKind } from "../entry.ts";
import * as example from "./examples.ts";
import { issues, without } from "./issues.ts";

const change = changeKind.schema;
const entry = entryKind.schema;

describe("change", () => {
  it("accepts the example", () => {
    expect(issues(change, example.change)).toStrictEqual([]);
    expect(changeKind.version).toBe(1);
    expect(changeKind.migrations).toStrictEqual([]);
  });

  it.each(Object.keys(example.change))("requires %s", (key) => {
    expect(issues(change, without(example.change, key))).toStrictEqual([key]);
  });

  it.each([
    ["kind", "chore"],
    ["profile", "medium"],
    ["source", "kernel"],
    ["id", "passwordless-login"],
    ["intent", ""],
    ["schema", 2],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(change, { ...example.change, [key]: value })).toStrictEqual([key]);
  });

  it("names an unknown key", () => {
    expect(issues(change, { ...example.change, status: "open" })).toStrictEqual(["status"]);
  });
});

describe("entry", () => {
  it("has ten types", () => {
    expect(ENTRY_TYPES).toStrictEqual([
      "decision",
      "finding",
      "observation",
      "blocker",
      "question",
      "assumption",
      "risk",
      "learning",
      "report",
      "transition",
    ]);
  });

  it.each([example.decision, example.finding, example.learning, example.transition])(
    "accepts the $type example",
    (data) => {
      expect(issues(entry, data)).toStrictEqual([]);
    },
  );

  it.each(ENTRY_TYPES.filter((type) => !["learning", "report", "transition"].includes(type)))(
    "accepts a %s with the common fields only",
    (type) => {
      expect(issues(entry, { ...example.decision, type })).toStrictEqual([]);
    },
  );

  it.each(["schema", "id", "summary", "status", "source", "author", "at", "refs"])(
    "requires %s",
    (key) => {
      expect(issues(entry, without(example.decision, key))).toStrictEqual([key]);
    },
  );

  it("keeps ticket, supersedes and review optional", () => {
    const full = {
      ...example.decision,
      ticket: "A-7f3kx2p9",
      supersedes: "2026-09-20-login/L-0000abcd",
      review: true,
    };
    expect(issues(entry, full)).toStrictEqual([]);
  });

  it("bounds summary to 1-120 characters", () => {
    expect(issues(entry, { ...example.decision, summary: "x".repeat(120) })).toStrictEqual([]);
    expect(issues(entry, { ...example.decision, summary: "x".repeat(121) })).toStrictEqual([
      "summary",
    ]);
    expect(issues(entry, { ...example.decision, summary: "" })).toStrictEqual(["summary"]);
  });

  it("needs at least one ref", () => {
    expect(issues(entry, { ...example.decision, refs: [] })).toStrictEqual(["refs"]);
  });

  it.each([
    ["status", "superseded"],
    ["source", "agent:"],
    ["id", "A-m2x9v7qa"],
    ["ticket", "L-7f3kx2p9"],
    ["at", "2026-09-25 09:41:07"],
    ["supersedes", "L-short"],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(entry, { ...example.decision, [key]: value })).toStrictEqual([key]);
  });

  it("rejects an unknown type", () => {
    expect(issues(entry, { ...example.decision, type: "note" })).toStrictEqual(["type"]);
  });

  it.each([
    ["finding", { severity: "high", category: "security" }],
    ["observation", { severity: "low" }],
    ["blocker", { category: "false-claim" }],
    ["question", { options: ["park", "continue"] }],
    ["report", { report: ".bdk/changes/2026-09-25-passwordless-login/reports/02-plan.md" }],
  ])("accepts the own fields of a %s", (type, own) => {
    expect(issues(entry, { ...example.decision, type, ...own })).toStrictEqual([]);
  });

  it.each([
    ["decision", "severity", "high"],
    ["observation", "category", "security"],
    ["finding", "options", ["a"]],
    ["risk", "fingerprint", `sha256:${"4".repeat(64)}`],
    ["blocker", "to", "plan"],
    ["learning", "report", "reports/x.md"],
  ])("rejects on a %s the %s of another type", (type, key, value) => {
    const base = type === "learning" ? example.learning : { ...example.decision, type };
    expect(issues(entry, { ...base, [key]: value })).toStrictEqual([key]);
  });

  it("requires fingerprint on a learning", () => {
    expect(issues(entry, without(example.learning, "fingerprint"))).toStrictEqual(["fingerprint"]);
  });

  it("requires routed-to on a routed learning", () => {
    const routed = { ...example.learning, status: "routed" };
    expect(issues(entry, routed)).toStrictEqual(["routed-to"]);
    expect(issues(entry, { ...routed, "routed-to": "rule" })).toStrictEqual([]);
    expect(issues(entry, { ...routed, "routed-to": "backlog" })).toStrictEqual(["routed-to"]);
  });

  it("requires report on a report entry", () => {
    expect(issues(entry, { ...example.decision, type: "report" })).toStrictEqual(["report"]);
  });

  it("requires to on a transition and types its optional fields", () => {
    expect(issues(entry, without(example.transition, "to"))).toStrictEqual(["to"]);
    expect(issues(entry, { ...example.transition, "skip-verify": "yes" })).toStrictEqual([
      "skip-verify",
    ]);
  });
});
