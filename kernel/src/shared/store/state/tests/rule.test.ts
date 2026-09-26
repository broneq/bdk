import { describe, expect, it } from "vitest";

import { ruleKind } from "../rule.ts";
import * as example from "./examples.ts";
import { issues, without } from "./issues.ts";

const schema = ruleKind.schema;
const knowledge = {
  ...example.rule,
  kind: "knowledge",
  source: "https://nodejs.org/api/sqlite.html",
  verified: "2026-09-20",
};

describe("rule", () => {
  it("accepts a house and a knowledge rule", () => {
    expect(issues(schema, example.rule)).toStrictEqual([]);
    expect(issues(schema, knowledge)).toStrictEqual([]);
  });

  it.each(["schema", "id", "kind", "severity", "origin", "since"])("requires %s", (key) => {
    expect(issues(schema, without(example.rule, key))).toStrictEqual([key]);
  });

  it("keeps applies and roles optional", () => {
    expect(issues(schema, without(without(example.rule, "applies"), "roles"))).toStrictEqual([]);
  });

  it.each(["CQ-4", "BDK-SEC-2", "TQ-17", "A1-B2-10"])("accepts the id %j", (id) => {
    expect(issues(schema, { ...example.rule, id })).toStrictEqual([]);
  });

  it.each(["cq-4", "CQ-0", "CQ-04", "CQ", "4-CQ", "CQ_4", "-CQ-4"])("rejects the id %j", (id) => {
    expect(issues(schema, { ...example.rule, id })).toStrictEqual(["id"]);
  });

  it.each(["bdk", "import", "2026-09-25-passwordless-login/L-q81c0zt4"])(
    "accepts the origin %j",
    (origin) => {
      expect(issues(schema, { ...example.rule, origin })).toStrictEqual([]);
    },
  );

  it.each(["user", "L-q81c0zt4", "2026-09-25-passwordless-login/A-7f3kx2p9"])(
    "rejects the origin %j",
    (origin) => {
      expect(issues(schema, { ...example.rule, origin })).toStrictEqual(["origin"]);
    },
  );

  it.each(["source", "verified"])("requires %s on a knowledge rule", (key) => {
    expect(issues(schema, without(knowledge, key))).toStrictEqual([key]);
  });

  it.each([
    ["source", "https://example.com"],
    ["verified", "2026-09-20"],
  ])("rejects %s on a house rule", (key, value) => {
    expect(issues(schema, { ...example.rule, [key]: value })).toStrictEqual([key]);
  });

  it("accepts a tombstone", () => {
    const removed = { ...example.rule, removed: "Covered by the linter since 2026-10" };
    expect(issues(schema, removed)).toStrictEqual([]);
  });

  it.each([
    ["severity", "blocker"],
    ["kind", "team"],
    ["since", "yesterday"],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(schema, { ...example.rule, [key]: value })).toStrictEqual([key]);
  });
});
