import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../../registrations.ts";
import { declaredSteps, keySteps, unknownKeyMessage, valueAt } from "../index.ts";

const registry = settingsRegistry();

describe("keySteps", () => {
  it("walks objects, id arrays and records", () => {
    expect(keySteps(registry.tree, "tools.test.unit.scoped")).toStrictEqual([
      { segment: "tools", id: false },
      { segment: "test", id: false },
      { segment: "unit", id: true },
      { segment: "scoped", id: false },
    ]);
    expect(keySteps(registry.tree, "prompts.files.rules/security")?.at(-1)).toStrictEqual({
      segment: "rules/security",
      id: false,
    });
  });

  it.each(["", "tools.tests", "languages.go", "features.lavish.x"])("declares no %j", (key) => {
    expect(keySteps(registry.tree, key)).toBeUndefined();
  });
});

describe("declaredSteps", () => {
  it("accepts a registered prompt key under prompts.files and refuses another", () => {
    expect(declaredSteps(registry, "prompts.files.rules/languages/go")).toHaveLength(3);
    expect(declaredSteps(registry, "prompts.files.rules/nope")).toBeUndefined();
  });
});

describe("unknownKeyMessage", () => {
  it.each([
    ["tools.tests", "unknown key; did you mean tools.test?"],
    ["policy.gates.design", "lands with T21"],
    ["features.serena", expect.stringMatching(/^removed v2 key: /) as unknown],
    ["zzz", "unknown key"],
  ])("explains %s", (key, message) => {
    expect(unknownKeyMessage(registry, key)).toEqual(message);
  });
});

describe("valueAt", () => {
  const root = { tools: { test: [{ id: "unit", command: "t" }] }, languages: ["go"] };

  it("follows keys and id segments", () => {
    const steps = keySteps(registry.tree, "tools.test.unit.command") ?? [];
    expect(valueAt(root, steps)).toBe("t");
  });

  it("is undefined past a missing id or key", () => {
    expect(valueAt(root, keySteps(registry.tree, "tools.test.e2e.command") ?? [])).toBeUndefined();
    expect(valueAt(root, keySteps(registry.tree, "features.lavish") ?? [])).toBeUndefined();
  });
});
