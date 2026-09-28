import { describe, expect, it } from "vitest";

import { mergeLayers } from "../index.ts";
import type { Layer } from "../index.ts";

const plain = (layers: readonly Layer[]) => mergeLayers(layers, new Set());

function layer(name: Layer["name"], values: Record<string, unknown>): Layer {
  return { name, path: `/${name}.yaml`, text: "", values };
}

describe("mergeLayers", () => {
  it("deep-merges mappings, the higher layer winning per leaf, with origins", () => {
    const merged = plain([
      layer("global", { features: { lavish: true }, a: { b: 1, c: 2 } }),
      layer("project", { a: { c: 3 } }),
      layer("local", { features: { lavish: false } }),
    ]);
    expect(merged.value).toStrictEqual({ features: { lavish: false }, a: { b: 1, c: 3 } });
    expect(merged.origins).toStrictEqual({
      "features.lavish": "local",
      "a.b": "global",
      "a.c": "project",
    });
  });

  it("merges arrays of mappings by id: a matching item deep-merges, a new one appends", () => {
    const merged = plain([
      layer("project", {
        tools: {
          test: [
            { id: "unit", tier: "fast", command: "pnpm test:unit" },
            { id: "e2e", tier: "e2e", command: "pnpm test:e2e" },
          ],
        },
      }),
      layer("local", {
        tools: {
          test: [
            { id: "unit", scoped: "pnpm vitest {files}" },
            { id: "mut", tier: "fast", command: "stryker" },
          ],
        },
      }),
    ]);
    expect(merged.value).toStrictEqual({
      tools: {
        test: [
          { id: "unit", tier: "fast", command: "pnpm test:unit", scoped: "pnpm vitest {files}" },
          { id: "e2e", tier: "e2e", command: "pnpm test:e2e" },
          { id: "mut", tier: "fast", command: "stryker" },
        ],
      },
    });
    expect(merged.origins["tools.test.unit.command"]).toBe("project");
    expect(merged.origins["tools.test.unit.scoped"]).toBe("local");
    expect(merged.origins["tools.test.mut.id"]).toBe("local");
  });

  it("replaces a scalar array whole", () => {
    const merged = plain([
      layer("project", { languages: ["typescript", "react"] }),
      layer("local", { languages: ["typescript"] }),
    ]);
    expect(merged.value).toStrictEqual({ languages: ["typescript"] });
    expect(merged.origins).toStrictEqual({ languages: "local" });
  });

  it("replaces an array whose items are not all mappings with an id", () => {
    const merged = plain([
      layer("project", { x: [{ id: "a" }] }),
      layer("local", { x: [{ name: "b" }] }),
    ]);
    expect(merged.value).toStrictEqual({ x: [{ name: "b" }] });
  });

  it("reports a duplicate id within one layer", () => {
    const merged = plain([layer("project", { tools: { lint: [{ id: "es" }, { id: "es" }] } })]);
    expect(merged.problems).toStrictEqual([
      {
        rule: "policy/config-invalid",
        key: "tools.lint",
        layer: "project",
        path: "/project.yaml",
        message: "the id es appears twice in one layer",
      },
    ]);
  });

  it("keeps null as a value and never deletes a lower key with it", () => {
    const merged = plain([
      layer("project", { features: { lavish: true } }),
      layer("local", { features: { lavish: null } }),
    ]);
    expect(merged.value).toStrictEqual({ features: { lavish: null } });
    expect(merged.origins).toStrictEqual({ "features.lavish": "local" });
  });

  it("lets a mapping replace a scalar and a scalar replace a mapping", () => {
    const merged = plain([
      layer("project", { a: 1, b: { c: 1 } }),
      layer("local", { a: { d: 2 }, b: 3 }),
    ]);
    expect(merged.value).toStrictEqual({ a: { d: 2 }, b: 3 });
    expect(merged.origins).toStrictEqual({ "a.d": "local", b: "local" });
  });

  it("keeps an empty mapping or array as a leaf with its origin", () => {
    const merged = plain([layer("project", { a: {}, b: [] })]);
    expect(merged.value).toStrictEqual({ a: {}, b: [] });
    expect(merged.origins).toStrictEqual({ a: "project", b: "project" });
  });

  it("appends to an append-only array, dropping items a lower layer holds", () => {
    const appendOnly = new Set(["policy.globs"]);
    const merged = mergeLayers(
      [
        layer("global", { policy: { globs: ["a/**", "b/**"] } }),
        layer("project", { policy: { globs: ["c/**", "a/**", "c/**"] } }),
        layer("local", { policy: { globs: ["b/**"] } }),
      ],
      appendOnly,
    );
    expect(merged.value).toStrictEqual({ policy: { globs: ["a/**", "b/**", "c/**"] } });
    expect(merged.origins).toStrictEqual({ "policy.globs": "local" });
  });

  it("replaces an array the module does not declare append-only", () => {
    const merged = mergeLayers(
      [
        layer("project", { policy: { globs: ["a/**"] } }),
        layer("local", { policy: { globs: [] } }),
      ],
      new Set(["policy.other"]),
    );
    expect(merged.value).toStrictEqual({ policy: { globs: [] } });
  });
});
