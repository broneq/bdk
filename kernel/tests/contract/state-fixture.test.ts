// `kernel-state`, State fixture: every file of the fixture `.bdk/` maps to a
// document kind and validates with zod (through the store) and with Ajv
// against `schema/state/`; every kind and entry type is present. Each rule
// has a negative control seeded into an in-memory copy of the fixture.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { KernelRefusal } from "../../src/shared/refusal/index.ts";
import {
  ENTRY_TYPES,
  generateDesignIndex,
  generatePlanIndex,
  memoryStore,
  readDocument,
  STATE_KINDS,
} from "../../src/shared/store/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { stateValidatorFor } from "../support/schemas.ts";

const ROOT = join(REPO_ROOT, "kernel/tests/fixtures/state");
const CHANGE = join(ROOT, ".bdk/changes/2026-09-25-passwordless-login");
const OPAQUE = ["spec-delta", "evidence-capture"];

function readTree(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[path] = readFileSync(path, "utf8");
  }
  return files;
}

/** The Ajv errors of one document against `schema/state/<kind>.json`. */
type JsonSchemaCheck = (kind: string, data: unknown) => string[];

const ajvCheck: JsonSchemaCheck = (kind, data) => {
  const validate = stateValidatorFor(kind);
  if (validate(data)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath} ${error.message ?? ""}`);
};

/** Every problem of the fixture, `<path>: <problem>`; [] when it is complete and valid. */
function problems(files: Readonly<Record<string, string>>, jsonSchema = ajvCheck): string[] {
  const store = memoryStore(files);
  const found: string[] = [];
  const kinds = new Set<string>();
  const types = new Set<string>();
  for (const path of Object.keys(files).sort()) {
    const name = relative(ROOT, path);
    try {
      const document = readDocument(store, path);
      if (document === undefined) throw new Error("unreadable");
      kinds.add(document.kind);
      if (!("data" in document)) continue;
      if (document.kind === "entry") types.add(String(document.data.type));
      const errors = jsonSchema(document.kind, document.data);
      if (errors.length > 0) found.push(`${name}: ajv: ${errors.join("; ")}`);
    } catch (error) {
      if (!(error instanceof KernelRefusal)) throw error;
      found.push(`${name}: zod: ${error.refusal.why}`);
    }
  }
  for (const kind of [...Object.keys(STATE_KINDS), ...OPAQUE]) {
    if (!kinds.has(kind)) found.push(`missing document kind ${kind}`);
  }
  for (const type of ENTRY_TYPES) {
    if (!types.has(type)) found.push(`missing entry type ${type}`);
  }
  return found;
}

const fixture = readTree(join(ROOT, ".bdk"));

describe("state fixture", () => {
  it("maps, validates and covers every kind and entry type", () => {
    expect(Object.keys(fixture).length).toBeGreaterThan(30);
    expect(problems(fixture)).toStrictEqual([]);
  });

  it("holds indexes equal to their regeneration from the parts", () => {
    const parts = (dir: string) =>
      Object.keys(fixture)
        .filter((path) => path.startsWith(join(CHANGE, dir, "parts")))
        .map((path) => fixtureData(path) as never);
    expect(fixture[join(CHANGE, "plan/index.md")]).toBe(generatePlanIndex(parts("plan")));
    expect(fixture[join(CHANGE, "design/index.md")]).toBe(generateDesignIndex(parts("design")));
  });

  it("fails on an unmapped file", () => {
    const seeded = { ...fixture, [join(CHANGE, "notes.md")]: "# Notes\n" };
    expect(problems(seeded)).toStrictEqual([expect.stringContaining("notes.md: zod: ") as string]);
  });

  it("fails on a missing entry type", () => {
    const seeded = Object.fromEntries(
      Object.entries(fixture).filter(([path]) => !path.includes("-risk-")),
    );
    expect(problems(seeded)).toStrictEqual(["missing entry type risk"]);
  });

  it("fails on a violation only the JSON Schema sees", () => {
    const stricter: JsonSchemaCheck = (kind, data) =>
      kind === "rule" && (data as { id?: unknown }).id === "CQ-3"
        ? ["/id must not be a tombstone"]
        : ajvCheck(kind, data);
    expect(problems(fixture, stricter)).toStrictEqual([
      ".bdk/rules/CQ-3.md: ajv: /id must not be a tombstone",
    ]);
  });

  it("rejects with Ajv what zod rejects", () => {
    const risk = { ...fixtureRisk(), mood: "ok" };
    expect(ajvCheck("entry", risk)).not.toStrictEqual([]);
    expect(ajvCheck("entry", fixtureRisk())).toStrictEqual([]);
  });
});

function fixtureRisk(): Record<string, unknown> {
  return fixtureData(join(CHANGE, "log/20260925T094830Z-risk-L-2k6mz8ua.md"));
}

function fixtureData(path: string): Record<string, unknown> {
  const document = readDocument(memoryStore(fixture), path);
  if (document === undefined || !("data" in document)) throw new Error(`no ${path}`);
  return document.data;
}
