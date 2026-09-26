import { describe, expect, it } from "vitest";

import { layoutFinding } from "../domain/layout.ts";

describe("layoutFinding", () => {
  it("is absent without a v2 marker", () => {
    expect(layoutFinding([])).toBeUndefined();
  });

  it.each([
    [[".bdk/runs/"], ".bdk/runs/ found"],
    [[".bdk/settings.json", ".bdk/plans/"], ".bdk/settings.json and .bdk/plans/ found"],
    [
      [".bdk/settings.json", ".bdk/runs/", ".bdk/plans/"],
      ".bdk/settings.json, .bdk/runs/ and .bdk/plans/ found",
    ],
  ])("names %j, repaired by bdk import", (present, summary) => {
    expect(layoutFinding(present)).toStrictEqual({
      id: "v2-layout",
      level: "warn",
      summary,
      repair: "bdk import",
    });
  });
});
