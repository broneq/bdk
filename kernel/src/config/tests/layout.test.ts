import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { classifyLayout } from "../domain/layout.ts";
import { detectLayout } from "../use-cases/layout.ts";

describe("classifyLayout", () => {
  it("is none without .bdk/", () => {
    expect(classifyLayout({ bdk: false, present: [] })).toStrictEqual({
      layout: "none",
      present: [],
    });
  });

  it("is v3 when .bdk/ holds no v2 marker", () => {
    expect(classifyLayout({ bdk: true, present: [] })).toStrictEqual({ layout: "v3", present: [] });
  });

  it("is v2 with the markers found", () => {
    expect(classifyLayout({ bdk: true, present: [".bdk/runs/"] })).toStrictEqual({
      layout: "v2",
      present: [".bdk/runs/"],
    });
  });
});

describe("detectLayout", () => {
  it("finds the v2 markers under the project root through the store", () => {
    const store = memoryStore({ "/repo/.bdk/settings.json": "{}", "/repo/.bdk/plans/a.md": "" });
    expect(detectLayout(store, "/repo")).toStrictEqual({
      layout: "v2",
      present: [".bdk/settings.json", ".bdk/plans/"],
    });
  });
});
