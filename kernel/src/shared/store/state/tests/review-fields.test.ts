// The fields T42 adds for review rounds (`kernel-state`, Ledger entry,
// Dispatch package, Report envelope, Evidence manifest): the review group of
// a `<ticket>@<group>` write, the triage level, the reviewed head of a merge
// report, and the tool a coverage manifest measured.
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../store.ts";
import { dispatchKind } from "../dispatch.ts";
import { readDocument, writeDocument } from "../documents.ts";
import { entryKind } from "../entry.ts";
import { evidenceKind } from "../evidence.ts";
import { reportKind } from "../report.ts";
import * as example from "./examples.ts";
import { issues, without } from "./issues.ts";

const CHANGE = "/repo/.bdk/changes/2026-09-25-passwordless-login";
const at = (path: string): string => `${CHANGE}/${path}`;
const HEAD = "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2";

const entry = entryKind.schema;
const reportEntry = {
  ...example.decision,
  id: "L-r3p0rt11",
  type: "report",
  status: "proposed",
  report: "reports/2026-09-25-passwordless-login-orchestrator-A-7f3kx2p9-merge.md",
};

describe("ledger entry", () => {
  it("takes a review group on any type", () => {
    expect(issues(entry, { ...example.finding, group: "p02" })).toStrictEqual([]);
    expect(issues(entry, { ...example.decision, group: "integration" })).toStrictEqual([]);
    expect(issues(entry, { ...example.finding, group: "P_02" })).toStrictEqual(["group"]);
  });

  it.each(["finding", "blocker", "observation"])("takes a level on a %s", (type) => {
    for (const level of ["blocker", "should-fix", "nice-to-have", "not-a-problem"]) {
      const own = type === "blocker" ? without(example.finding, "severity") : example.finding;
      expect(issues(entry, { ...own, type, level })).toStrictEqual([]);
    }
  });

  it("refuses an unknown level and a level on another type", () => {
    expect(issues(entry, { ...example.finding, level: "critical" })).toStrictEqual(["level"]);
    expect(issues(entry, { ...example.decision, level: "blocker" })).toStrictEqual(["level"]);
  });

  it("takes head only on a merge report", () => {
    expect(issues(entry, { ...reportEntry, group: "merge", head: HEAD })).toStrictEqual([]);
    expect(issues(entry, { ...reportEntry, head: HEAD })).toStrictEqual(["head"]);
    expect(issues(entry, { ...reportEntry, group: "p01", head: HEAD })).toStrictEqual(["head"]);
    expect(issues(entry, { ...reportEntry, group: "merge", head: "HEAD~1" })).toStrictEqual([
      "head",
    ]);
  });
});

describe("dispatch package", () => {
  const grouped = {
    ...example.dispatch,
    role: "reviewer",
    group: "p01",
    files: ["src/auth/login.ts"],
  };

  it("takes a group with its files, and neither", () => {
    expect(issues(dispatchKind.schema, grouped)).toStrictEqual([]);
    expect(issues(dispatchKind.schema, example.dispatch)).toStrictEqual([]);
  });

  it("keeps group and files together", () => {
    expect(issues(dispatchKind.schema, without(grouped, "files"))).toStrictEqual(["files"]);
    expect(issues(dispatchKind.schema, without(grouped, "group"))).toStrictEqual(["group"]);
  });

  it("names its entries on a judge package and only there (#158)", () => {
    const judge = { ...grouped, role: "judge", group: "judge", files: [] };
    expect(
      issues(dispatchKind.schema, { ...judge, entries: ["L-a1b2c3d4", "L-c3d4e5f6"] }),
    ).toStrictEqual([]);
    expect(issues(dispatchKind.schema, judge)).toStrictEqual(["entries"]);
    expect(issues(dispatchKind.schema, { ...grouped, entries: [] })).toStrictEqual(["entries"]);
    expect(issues(dispatchKind.schema, { ...judge, entries: ["x"] })).toStrictEqual(["entries.0"]);
  });

  it("is laid out under its group's name", () => {
    const store = memoryStore();
    const path = at("dispatch/02-3-reviewer-A-7f3kx2p9-p01.md");
    writeDocument(store, path, { data: { ...grouped, target: "02-3" }, body: "" });
    expect(readDocument(store, path)).toMatchObject({ data: { group: "p01" } });
    expect(() => {
      writeDocument(store, at("dispatch/02-3-reviewer-A-7f3kx2p9-p02.md"), {
        data: { ...grouped, target: "02-3" },
        body: "",
      });
    }).toThrow(/group does not match the file name/);
  });
});

describe("report envelope", () => {
  it("takes a group and the orchestrator role of a merge report", () => {
    const merge = { ...example.report, role: "orchestrator", group: "merge", files: [] };
    expect(issues(reportKind.schema, merge)).toStrictEqual([]);
    const store = memoryStore();
    const path = at("reports/2026-09-25-passwordless-login-orchestrator-A-7f3kx2p9-merge.md");
    writeDocument(store, path, { data: merge, body: "# Review\n" });
    expect(readDocument(store, path)).toMatchObject({ data: { group: "merge" } });
  });

  it("checks the group against the file name", () => {
    expect(() => {
      writeDocument(memoryStore(), at("reports/02-3-reviewer-A-7f3kx2p9-p01.md"), {
        data: { ...example.report, role: "reviewer", group: "p02" },
        body: "",
      });
    }).toThrow(/group does not match the file name/);
  });
});

describe("evidence manifest", () => {
  it("takes a group", () => {
    expect(
      issues(evidenceKind.schema, { ...example.evidence, kind: "tests-full", group: "gate" }),
    ).toStrictEqual([]);
  });

  it("requires tool on a coverage manifest and only there", () => {
    const coverage = { ...example.evidence, kind: "coverage" };
    expect(issues(evidenceKind.schema, { ...coverage, tool: "unit" })).toStrictEqual([]);
    expect(issues(evidenceKind.schema, coverage)).toStrictEqual(["tool"]);
    expect(issues(evidenceKind.schema, { ...example.evidence, tool: "unit" })).toStrictEqual([
      "tool",
    ]);
  });
});
