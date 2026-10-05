// The three states of a tool group (`kernel-settings`, Tool entries; T49):
// configured, declared none, unset, through the real `tools` module, the
// merge and the key tree.
import { describe, expect, it } from "vitest";

import {
  createConfigRegistry,
  declaredSteps,
  mergeLayers,
  moduleValue,
  toolGroup,
  toolsModule,
  validateLayers,
} from "../index.ts";
import type { Layer } from "../index.ts";

const registry = createConfigRegistry({ modules: [toolsModule], prompts: [] });

function layer(name: Layer["name"], values: Record<string, unknown>): Layer {
  return { name, path: `/${name}.yaml`, text: "", values };
}

function validate(...layers: Layer[]) {
  return validateLayers(registry, layers, mergeLayers(layers, registry.appendOnly));
}

const ESLINT = { id: "eslint", tier: "lint", command: "eslint ." };

describe("tool group states", () => {
  it("leaves test and lint unset when no layer sets them", () => {
    const result = validate();
    expect(result.problems).toStrictEqual([]);
    const tools = moduleValue(toolsModule, result.value ?? {});
    expect(tools.test).toBeUndefined();
    expect(tools.lint).toBeUndefined();
    expect(tools.build).toStrictEqual([]);
    expect(toolGroup(tools, "lint")).toStrictEqual({ state: "unset", entries: [] });
  });

  it("accepts none as the declared-none state", () => {
    const result = validate(layer("project", { tools: { lint: "none" } }));
    expect(result.problems).toStrictEqual([]);
    const tools = moduleValue(toolsModule, result.value ?? {});
    expect(tools.lint).toBe("none");
    expect(toolGroup(tools, "lint")).toStrictEqual({ state: "none", entries: [] });
  });

  it("answers the entries of a configured group", () => {
    const result = validate(layer("project", { tools: { lint: [ESLINT] } }));
    const tools = moduleValue(toolsModule, result.value ?? {});
    expect(toolGroup(tools, "lint")).toStrictEqual({ state: "configured", entries: [ESLINT] });
  });

  it("refuses an empty list, naming none", () => {
    const result = validate(layer("project", { tools: { lint: [] } }));
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({
      rule: "policy/config-invalid",
      key: "tools.lint",
      layer: "project",
    });
    expect(result.problems[0]?.message).toMatch(/none/);
  });

  it("refuses another scalar, naming none", () => {
    const result = validate(layer("project", { tools: { test: "off" } }));
    expect(result.problems[0]).toMatchObject({ rule: "policy/config-invalid", key: "tools.test" });
    expect(result.problems[0]?.message).toMatch(/none/);
  });

  it("names the field of an invalid entry, not the group", () => {
    const result = validate(
      layer("project", { tools: { test: [{ id: "unit", command: "vitest run" }] } }),
    );
    expect(result.problems).toStrictEqual([
      expect.objectContaining({ rule: "policy/config-invalid", key: "tools.test.unit.tier" }),
    ]);
  });

  it("names an unknown field of an entry", () => {
    const result = validate(layer("project", { tools: { lint: [{ ...ESLINT, coverage: {} }] } }));
    expect(result.problems).toStrictEqual([
      expect.objectContaining({
        rule: "policy/unknown-config-key",
        key: "tools.lint.eslint.coverage",
      }),
    ]);
  });

  it("lets a local none replace project entries", () => {
    const result = validate(
      layer("project", { tools: { lint: [ESLINT] } }),
      layer("local", { tools: { lint: "none" } }),
    );
    expect(moduleValue(toolsModule, result.value ?? {}).lint).toBe("none");
  });

  it("starts a higher layer's entries from none of the lower none", () => {
    const result = validate(
      layer("project", { tools: { lint: "none" } }),
      layer("local", { tools: { lint: [ESLINT] } }),
    );
    expect(moduleValue(toolsModule, result.value ?? {}).lint).toStrictEqual([ESLINT]);
  });

  it("keeps an entry addressable by its id", () => {
    expect(declaredSteps(registry, "tools.test.unit.scoped")).toStrictEqual([
      { segment: "tools", id: false },
      { segment: "test", id: false },
      { segment: "unit", id: true },
      { segment: "scoped", id: false },
    ]);
    expect(declaredSteps(registry, "tools.lint")).toHaveLength(2);
  });
});
