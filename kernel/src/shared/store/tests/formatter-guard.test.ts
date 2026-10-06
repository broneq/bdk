import { describe, expect, it } from "vitest";

import { ensureFormatterGuard, FORMATTER_GUARD, formatterGuardState } from "../formatter-guard.ts";
import { memoryStore } from "../store.ts";

const ROOT = "/repo";
const PATH = `${ROOT}/.bdk/.prettierrc`;

describe("ensureFormatterGuard", () => {
  it("writes the guard when it is absent", () => {
    const store = memoryStore();
    expect(ensureFormatterGuard(store, ROOT)).toBe(true);
    expect(store.read(PATH)).toBe(FORMATTER_GUARD);
    expect(FORMATTER_GUARD).toBe(
      '{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }\n',
    );
  });

  it("is idempotent", () => {
    const store = memoryStore();
    ensureFormatterGuard(store, ROOT);
    expect(ensureFormatterGuard(store, ROOT)).toBe(false);
    expect(store.read(PATH)).toBe(FORMATTER_GUARD);
  });

  it("never changes a file the user wrote", () => {
    const store = memoryStore({ [PATH]: '{"semi": false}' });
    expect(ensureFormatterGuard(store, ROOT)).toBe(false);
    expect(store.read(PATH)).toBe('{"semi": false}');
  });
});

describe("formatterGuardState", () => {
  it.each([
    ["the kernel's guard", FORMATTER_GUARD, "ok"],
    [
      "a guard in YAML",
      "requirePragma: true\noverrides:\n  - files: ['*', '*.md']\n    options:\n      parser: yaml\n",
      "ok",
    ],
    ["a guard without the option", '{"semi": false}', "weak"],
    ["the pragma alone, which JSON ignores", '{ "requirePragma": true }', "weak"],
    [
      "an override for some files only",
      '{ "requirePragma": true, "overrides": [{ "files": "*.md", "options": { "parser": "yaml" } }] }',
      "weak",
    ],
    [
      "the option off",
      '{ "requirePragma": false, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }',
      "weak",
    ],
    ["a list", "- requirePragma\n", "weak"],
    ["broken syntax", "{ requirePragma: [", "weak"],
    ["an empty file", "", "weak"],
  ])("%s is %s", (_, text, state) => {
    expect(formatterGuardState(memoryStore({ [PATH]: text }), ROOT)).toBe(state);
  });

  it("is missing without the file", () => {
    expect(formatterGuardState(memoryStore(), ROOT)).toBe("missing");
  });
});
