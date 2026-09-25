// Design D-3: `node:sqlite` loads on first index open only, so `version` and
// `doctor` run on a Node below the floor without the loader failing first.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BUNDLE } from "./support/run.ts";

describe("dist/bdk.mjs", () => {
  const bundle = readFileSync(BUNDLE, "utf8");

  it("has no static node:sqlite import", () => {
    expect(bundle).not.toMatch(/^\s*import\b[^;]*["']node:sqlite["']/m);
  });
});
