import { describe, expect, it } from "vitest";
import * as z from "zod";

import { KernelRefusal } from "../../../refusal/index.ts";
import type { Refusal } from "../../../refusal/index.ts";
import { memoryStore } from "../../store.ts";
import { attemptKind } from "../attempt.ts";
import { migrateDocument, readDocument, writeDocument } from "../documents.ts";
import { renderDocument } from "../render.ts";
import * as example from "./examples.ts";
import { without } from "./issues.ts";

const CHANGE = "/repo/.bdk/changes/2026-09-25-passwordless-login";
const at = (path: string): string => `${CHANGE}/${path}`;

function refusal(action: () => unknown): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof KernelRefusal) return error.refusal;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("the layout maps each path to its kind", () => {
  it.each([
    ["change", at("change.md"), example.change],
    ["entry", at("log/20260925T094107Z-decision-L-m2x9v7qa.md"), example.decision],
    ["design", at("design.md"), example.design],
    ["design", at("architecture.md"), example.design],
    ["design-part", at("design/parts/01-auth-service.md"), example.designPart],
    [
      "design-index",
      at("design/index.md"),
      { schema: 1, generated: true, parts: [{ id: "01", title: "Auth", "depends-on": [] }] },
    ],
    ["plan-part", at("plan/parts/02-login.md"), example.planPart],
    ["plan-index", at("plan/index.md"), { schema: 1, generated: true, parts: [] }],
    ["attempt", at("attempts/task-redispatch-02-3-A-7f3kx2p9.md"), example.attempt],
    ["evidence", at("evidence/02-3-E-5hq0m2vd.md"), example.evidence],
    ["dispatch", at("dispatch/02-3-implementer-A-7f3kx2p9.md"), example.dispatch],
    ["report", at("reports/02-3-implementer-A-7f3kx2p9.md"), example.report],
    ["rule", "/repo/.bdk/rules/TQ-7.md", example.rule],
    [
      "change",
      "/repo/.bdk/changes/archive/2026-09-25-passwordless-login/change.md",
      example.change,
    ],
  ])("%s at %s", (kind, path, data) => {
    const store = memoryStore();
    writeDocument(store, path, { data, body: "Body.\n" });
    expect(store.read(path)).toBe(renderDocument(data, "Body.\n"));
    expect(readDocument(store, path)).toStrictEqual({ kind, data, body: "Body.\n" });
  });

  it("maps spec deltas and evidence captures without a schema", () => {
    const store = memoryStore();
    const delta = at("spec-delta/auth-login.md");
    const capture = at("evidence/02-3-E-5hq0m2vd.junit.xml");
    writeDocument(store, delta, { body: "## ADDED Requirements\n" });
    writeDocument(store, capture, { body: "<testsuites/>\n" });
    expect(readDocument(store, delta)).toStrictEqual({
      kind: "spec-delta",
      body: "## ADDED Requirements\n",
    });
    expect(readDocument(store, capture)).toStrictEqual({
      kind: "evidence-capture",
      body: "<testsuites/>\n",
    });
  });

  it("answers undefined for a missing file", () => {
    expect(readDocument(memoryStore(), at("change.md"))).toBeUndefined();
  });
});

describe("paths outside the layout", () => {
  it.each([
    at("notes.md"),
    at("log/decision-L-m2x9v7qa.md"),
    at("plan/parts/2-login.md"),
    at("attempts/A-7f3kx2p9.md"),
    "/repo/.bdk/changes/login/change.md",
    "/repo/.bdk/rules/nested/CQ-1.md",
    "/repo/.bdk/settings.yaml",
    "/repo/src/change.md",
  ])("refuses to read %s", (path) => {
    const store = memoryStore({ [path]: "---\nschema: 1\n---\n" });
    const { rule, why } = refusal(() => readDocument(store, path));
    expect(rule).toBe("state/ledger-invalid");
    expect(why).toContain("matches no row of the layout table");
  });

  it("refuses to write one and leaves the store unchanged", () => {
    const store = memoryStore();
    const { rule } = refusal(() => {
      writeDocument(store, at("notes.md"), { data: example.design, body: "" });
    });
    expect(rule).toBe("policy/validation-failed");
    expect(store.list(CHANGE)).toStrictEqual([]);
  });
});

describe("validation", () => {
  const log = at("log/20260925T094107Z-decision-L-m2x9v7qa.md");

  it("refuses an invalid write before any file changes", () => {
    const store = memoryStore({ [log]: "old\n" });
    const { rule, why } = refusal(() => {
      writeDocument(store, log, { data: without(example.decision, "refs"), body: "" });
    });
    expect(rule).toBe("policy/validation-failed");
    expect(why).toContain("refs");
    expect(store.read(log)).toBe("old\n");
  });

  it("names the file and the field of an invalid committed file", () => {
    const store = memoryStore({ [log]: renderDocument(without(example.decision, "refs"), "") });
    const { rule, why } = refusal(() => readDocument(store, log));
    expect(rule).toBe("state/ledger-invalid");
    expect(why).toContain(".bdk/changes/2026-09-25-passwordless-login/log/");
    expect(why).toContain("refs");
  });

  it("names an unknown key", () => {
    const store = memoryStore({ [log]: renderDocument({ ...example.decision, mood: "ok" }, "") });
    expect(refusal(() => readDocument(store, log)).why).toContain("mood");
  });

  it.each([
    ["no frontmatter", "Just text.\n"],
    ["broken YAML", "---\nschema: [1\n---\n"],
    ["a list", "---\n- 1\n---\n"],
    ["no schema", "---\ntitle: x\n---\n"],
    ["a text schema", '---\nschema: "1"\ntitle: x\n---\n'],
  ])("refuses %s", (_name, text) => {
    const store = memoryStore({ [at("design.md")]: text });
    expect(refusal(() => readDocument(store, at("design.md"))).rule).toBe("state/ledger-invalid");
  });

  it.each([
    ["log/20260925T094107Z-finding-L-m2x9v7qa.md", "type"],
    ["log/20260925T094107Z-decision-L-0000abcd.md", "id"],
    ["log/20260925T094108Z-decision-L-m2x9v7qa.md", "at"],
  ])("checks %s against the entry, naming %s", (path, field) => {
    const store = memoryStore();
    const { rule, why } = refusal(() => {
      writeDocument(store, at(path), { data: example.decision, body: "" });
    });
    expect(rule).toBe("policy/validation-failed");
    expect(why).toContain(`${field} does not match the file name`);
  });

  it.each([
    ["change.md", example.change, "id", "2026-09-24-other"],
    ["plan/parts/03-login.md", example.planPart, "id", undefined],
    ["design/parts/02-auth.md", example.designPart, "id", undefined],
    ["attempts/verify-fix-02-3-A-7f3kx2p9.md", example.attempt, "loop", undefined],
    ["attempts/task-redispatch-02-3-A-0000abcd.md", example.attempt, "ticket", undefined],
    ["evidence/02-4-E-5hq0m2vd.md", example.evidence, "target", undefined],
    ["dispatch/02-3-reviewer-A-7f3kx2p9.md", example.dispatch, "role", undefined],
    ["reports/02-3-reviewer-A-7f3kx2p9.md", example.report, "role", undefined],
  ])("checks %s against the document, naming %s", (path, data, field, value) => {
    const document = value === undefined ? data : { ...data, [field]: value };
    const { why } = refusal(() => {
      writeDocument(memoryStore(), at(path), { data: document, body: "" });
    });
    expect(why).toContain(`${field} does not match the file name`);
  });

  it("checks a rule id against its file name", () => {
    const { why } = refusal(() => {
      writeDocument(memoryStore(), "/repo/.bdk/rules/TQ-8.md", { data: example.rule, body: "" });
    });
    expect(why).toContain("id does not match the file name");
  });

  it("refuses data for a spec delta and a document without data", () => {
    expect(
      refusal(() => {
        writeDocument(memoryStore(), at("spec-delta/auth.md"), { data: {}, body: "" });
      }).rule,
    ).toBe("policy/validation-failed");
    expect(
      refusal(() => {
        writeDocument(memoryStore(), at("design.md"), { body: "" });
      }).rule,
    ).toBe("policy/validation-failed");
  });
});

describe("versions", () => {
  const path = at("attempts/task-redispatch-02-3-A-7f3kx2p9.md");
  const version2 = {
    ...attemptKind,
    version: 2,
    schema: z.strictObject({
      ...attemptKind.schema.shape,
      schema: z.literal(2),
      reviewer: z.string(),
    }),
    migrations: [(data: Record<string, unknown>) => ({ ...data, schema: 2, reviewer: "none" })],
  };

  it("refuses an older document naming bdk rebuild", () => {
    const store = memoryStore({ [path]: renderDocument(example.attempt, "") });
    const found = refusal(() => readDocument(store, path, { attempt: version2 }));
    expect(found.rule).toBe("state/ledger-invalid");
    expect(found.why).toContain("schema 1");
    expect(found.instead).toContain("bdk rebuild");
  });

  it("refuses a newer document naming the upgrade", () => {
    const store = memoryStore({ [path]: renderDocument({ ...example.attempt, schema: 2 }, "") });
    const found = refusal(() => readDocument(store, path));
    expect(found.rule).toBe("state/ledger-invalid");
    expect(found.why).toContain("newer BDK");
    expect(found.instead.join(" ")).toContain("upgrade");
  });

  it("migrates an older document in place and validates it", () => {
    const store = memoryStore({ [path]: renderDocument(example.attempt, "Reason.\n") });
    expect(migrateDocument(store, path, { attempt: version2 })).toStrictEqual({
      status: "migrated",
      from: 1,
      to: 2,
    });
    expect(readDocument(store, path, { attempt: version2 })).toStrictEqual({
      kind: "attempt",
      data: { ...example.attempt, schema: 2, reviewer: "none" },
      body: "Reason.\n",
    });
  });

  it("leaves current, newer and unmigratable documents unchanged", () => {
    const current = renderDocument(example.attempt, "");
    const newer = renderDocument({ ...example.attempt, schema: 3 }, "");
    const store = memoryStore({ [path]: current });
    expect(migrateDocument(store, path)).toStrictEqual({ status: "current" });

    store.write(path, newer);
    const skipped = migrateDocument(store, path, { attempt: version2 });
    expect(skipped.status).toBe("skipped");
    expect(store.read(path)).toBe(newer);

    store.write(path, current);
    const broken = { ...version2, migrations: [(data: Record<string, unknown>) => data] };
    expect(migrateDocument(store, path, { attempt: broken }).status).toBe("skipped");
    expect(store.read(path)).toBe(current);

    const noPath = { ...version2, migrations: [] };
    expect(migrateDocument(store, path, { attempt: noPath }).status).toBe("skipped");
    expect(store.read(path)).toBe(current);
  });

  it("skips a missing file and a spec delta", () => {
    const store = memoryStore({ [at("spec-delta/auth.md")]: "text\n" });
    expect(migrateDocument(store, at("change.md")).status).toBe("skipped");
    expect(migrateDocument(store, at("spec-delta/auth.md"))).toStrictEqual({ status: "current" });
  });
});
