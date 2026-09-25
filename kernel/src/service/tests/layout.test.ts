import { describe, expect, it } from "vitest";

import { classifyLayout } from "../domain/layout.ts";

describe("classifyLayout", () => {
  it("is none without .bdk/", () => {
    expect(classifyLayout({ bdk: false, present: [] })).toStrictEqual({ layout: "none" });
  });

  it("is v3 when .bdk/ holds no v2 marker", () => {
    expect(classifyLayout({ bdk: true, present: [] })).toStrictEqual({ layout: "v3" });
  });

  it.each([
    [[".bdk/runs/"], ".bdk/runs/ found"],
    [[".bdk/settings.json", ".bdk/plans/"], ".bdk/settings.json and .bdk/plans/ found"],
    [
      [".bdk/settings.json", ".bdk/runs/", ".bdk/plans/"],
      ".bdk/settings.json, .bdk/runs/ and .bdk/plans/ found",
    ],
  ])("is v2 with %j, repaired by bdk import", (present, summary) => {
    expect(classifyLayout({ bdk: true, present })).toStrictEqual({
      layout: "v2",
      finding: { id: "v2-layout", level: "warn", summary, repair: "bdk import" },
    });
  });
});
