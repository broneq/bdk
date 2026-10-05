import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { classifyLayout, V2_MARKERS } from "../domain/layout.ts";
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

describe("V2_MARKERS", () => {
  it("names the five paths /bdk:setup deletes, in its order", () => {
    expect(V2_MARKERS).toStrictEqual([
      ".bdk/settings.json",
      ".bdk/runs/",
      ".bdk/plans/",
      ".bdk/design/",
      ".bdk/verify-plan/",
    ]);
  });
});

describe("detectLayout", () => {
  it("finds a v2 layout of plan verification reports and designs only", () => {
    const store = memoryStore({
      "/repo/.bdk/verify-plan/a-verification.md": "",
      "/repo/.bdk/design/a.md": "",
    });
    expect(detectLayout(store, "/repo")).toStrictEqual({
      layout: "v2",
      present: [".bdk/design/", ".bdk/verify-plan/"],
    });
  });

  it("finds the v2 markers under the project root through the store", () => {
    const store = memoryStore({ "/repo/.bdk/settings.json": "{}", "/repo/.bdk/plans/a.md": "" });
    expect(detectLayout(store, "/repo")).toStrictEqual({
      layout: "v2",
      present: [".bdk/settings.json", ".bdk/plans/"],
    });
  });
});
