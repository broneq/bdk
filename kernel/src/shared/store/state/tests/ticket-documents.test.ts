import { describe, expect, it } from "vitest";

import { attemptKind } from "../attempt.ts";
import { dispatchKind } from "../dispatch.ts";
import { evidenceKind } from "../evidence.ts";
import { reportKind } from "../report.ts";
import * as example from "./examples.ts";
import { issues, without } from "./issues.ts";

const attempt = attemptKind.schema;
const evidence = evidenceKind.schema;
const dispatch = dispatchKind.schema;
const report = reportKind.schema;

describe("attempt", () => {
  const open = without(without(without(example.attempt, "closed-at"), "outcome"), "findings");

  it("accepts an open and a closed record", () => {
    expect(issues(attempt, open)).toStrictEqual([]);
    expect(issues(attempt, example.attempt)).toStrictEqual([]);
  });

  it.each(["schema", "ticket", "loop", "target", "attempt", "of", "scope", "opened-at", "author"])(
    "requires %s",
    (key) => {
      expect(issues(attempt, without(open, key))).toStrictEqual([key]);
    },
  );

  it("keeps closed-at and outcome together", () => {
    expect(issues(attempt, without(example.attempt, "closed-at"))).toStrictEqual(["closed-at"]);
    expect(issues(attempt, without(example.attempt, "outcome"))).toStrictEqual(["outcome"]);
  });

  it.each([
    ["attempt", 0],
    ["of", 1.5],
    ["scope", "medium+"],
    ["narrowed-from", "all"],
    ["outcome", "error"],
    ["escalation", "yes"],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(attempt, { ...example.attempt, [key]: value })).toStrictEqual([key]);
  });

  it("drops only ledger ids", () => {
    expect(issues(attempt, { ...example.attempt, dropped: ["A-7f3kx2p9"] })).toStrictEqual([
      "dropped.0",
    ]);
  });

  it("types each finding", () => {
    const [first] = example.attempt.findings;
    const withoutSymbol = without(first ?? {}, "symbol");
    expect(issues(attempt, { ...example.attempt, findings: [withoutSymbol] })).toStrictEqual([]);
    expect(
      issues(attempt, { ...example.attempt, findings: [without(first ?? {}, "file")] }),
    ).toStrictEqual(["findings.0.file"]);
    expect(
      issues(attempt, { ...example.attempt, findings: [{ ...first, line: 3 }] }),
    ).toStrictEqual(["findings.0.line"]);
  });
});

describe("evidence", () => {
  it("accepts the example", () => {
    expect(issues(evidence, example.evidence)).toStrictEqual([]);
  });

  it.each([
    "schema",
    "id",
    "kind",
    "ticket",
    "target",
    "at",
    "author",
    "source",
    "tree-hash",
    "files",
  ])("requires %s", (key) => {
    expect(issues(evidence, without(example.evidence, key))).toStrictEqual([key]);
  });

  it("needs at least one file", () => {
    expect(issues(evidence, { ...example.evidence, files: [] })).toStrictEqual(["files"]);
  });

  it("stores a file committed or in .machine", () => {
    const [file] = example.evidence.files;
    const machine = { ...file, stored: "machine" };
    expect(issues(evidence, { ...example.evidence, files: [machine] })).toStrictEqual([]);
    const lost = { ...file, stored: "cloud" };
    expect(issues(evidence, { ...example.evidence, files: [lost] })).toStrictEqual([
      "files.0.stored",
    ]);
  });

  it.each([
    ["source", "user"],
    ["verdict", "unknown"],
    ["tree-hash", "abc"],
    ["id", "L-5hq0m2vd"],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(evidence, { ...example.evidence, [key]: value })).toStrictEqual([key]);
  });
});

describe("dispatch", () => {
  it("accepts the example", () => {
    expect(issues(dispatch, example.dispatch)).toStrictEqual([]);
  });

  it.each(Object.keys(example.dispatch))("requires %s", (key) => {
    expect(issues(dispatch, without(example.dispatch, key))).toStrictEqual([key]);
  });
});

describe("report", () => {
  it("accepts the example and empty lists", () => {
    expect(issues(report, example.report)).toStrictEqual([]);
    const readOnly = { ...example.report, files: [], evidence: [], status: "done-with-concerns" };
    expect(issues(report, readOnly)).toStrictEqual([]);
  });

  it.each(Object.keys(example.report))("requires %s", (key) => {
    expect(issues(report, without(example.report, key))).toStrictEqual([key]);
  });

  it("takes the four statuses of the return contract", () => {
    expect(issues(report, { ...example.report, status: "failed" })).toStrictEqual(["status"]);
  });

  it.each(["blocked", "needs-context"])("requires reason when %s", (status) => {
    expect(issues(report, { ...example.report, status })).toStrictEqual(["reason"]);
    expect(issues(report, { ...example.report, status, reason: "no token store" })).toStrictEqual(
      [],
    );
  });

  it.each([
    ["entries", ["E-5hq0m2vd"]],
    ["evidence", ["L-m2x9v7qa"]],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(report, { ...example.report, [key]: value })).toStrictEqual([`${key}.0`]);
  });
});
