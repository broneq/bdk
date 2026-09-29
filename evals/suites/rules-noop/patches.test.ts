import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { prepareFixture } from "../../harness/fixture.ts";
import { readVersions, RUNS_DIR } from "../../harness/paths.ts";
import { readBullets } from "./bullets.ts";
import { addedLines, checkPatch, patchNames, readPatch, readViolations } from "./patches.ts";

describe("addedLines", () => {
  it("numbers added lines in the new file across hunks and skips removed ones", () => {
    const patch = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -1,3 +1,3 @@",
      " keep",
      "-old",
      "+new",
      " keep",
      "@@ -10,2 +10,3 @@",
      " ten",
      "+eleven",
      "+twelve",
      "diff --git a/gone.ts b/gone.ts",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
    ].join("\n");
    expect(addedLines(patch)).toEqual(
      new Map([
        [
          "x.ts",
          new Map([
            [2, "new"],
            [11, "eleven"],
            [12, "twelve"],
          ]),
        ],
      ]),
    );
  });
});

describe("violations.yaml", () => {
  const bullets = new Set(readBullets().map((bullet) => bullet.id));
  const violations = readViolations();
  const seeded = violations.patches.flatMap((entry) => entry.violations);

  it("has one entry per patch file, at least three of them clean controls", () => {
    expect(violations.patches.map((entry) => entry.patch)).toEqual(patchNames());
    expect(
      violations.patches.filter((entry) => entry.violations.length === 0).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("names only existing bullet ids", () => {
    const unknown = [
      ...seeded.map((violation) => violation.bullet),
      ...violations.notSeedable.map((entry) => entry.bullet),
    ].filter((id) => !bullets.has(id));
    expect(unknown).toEqual([]);
  });

  it("points every violation at a line its patch adds", () => {
    const misplaced = violations.patches.flatMap((entry) => {
      const added = addedLines(readPatch(entry.patch));
      return entry.violations
        .filter((violation) => added.get(violation.file)?.get(violation.line) === undefined)
        .map(
          (violation) =>
            `${entry.patch} ${violation.bullet} ${violation.file}:${String(violation.line)}`,
        );
    });
    expect(misplaced).toEqual([]);
  });

  it("accounts for every bullet: seeded or not seedable with a reason, never both", () => {
    const seededIds = new Set(seeded.map((violation) => violation.bullet));
    const notSeedable = violations.notSeedable.map((entry) => entry.bullet);
    expect(notSeedable.filter((id) => seededIds.has(id))).toEqual([]);
    expect(new Set(notSeedable).size).toBe(notSeedable.length);
    expect(violations.notSeedable.filter((entry) => entry.reason.trim() === "")).toEqual([]);
    expect([...seededIds, ...notSeedable].sort()).toEqual([...bullets].sort());
  });
});

describe("patches", () => {
  // Fetches the pinned fixture once into its own cache (no dependency
  // install), separate from the suites' installed base.
  it("each applies to the stripped fixture base", { timeout: 120_000 }, () => {
    const base = prepareFixture(readVersions().fixture, join(RUNS_DIR, "cache-patches"));
    const failing = patchNames().filter((name) => {
      try {
        checkPatch(base, name);
        return false;
      } catch {
        return true;
      }
    });
    expect(failing).toEqual([]);
  });
});
