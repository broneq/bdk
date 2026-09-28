import { describe, expect, it } from "vitest";

import { firstMatch, matchesGlob } from "../glob.ts";

describe("matchesGlob", () => {
  it.each([
    ["src/legacy/**", "src/legacy/a.ts", true],
    ["src/legacy/**", "src/legacy/deep/b.ts", true],
    ["src/legacy/**", "src/legacyx/a.ts", false],
    ["src/*.ts", "src/a.ts", true],
    ["src/*.ts", "src/deep/a.ts", false],
    ["**/*.sql", "db/migrations/001.sql", true],
    ["**/*.sql", "001.sql", true],
    ["src/a?.ts", "src/ab.ts", true],
    ["src/a?.ts", "src/a/.ts", false],
    ["migrations/", "migrations/001.sql", true],
    ["migrations", "migrations/001.sql", true],
    ["migrations", "migrations", true],
    ["migrations", "migrations2/x", false],
    ["./src/a.ts", "src/a.ts", true],
    ["src/a.ts", "./src/a.ts", true],
    ["src/a+b.ts", "src/a+b.ts", true],
    ["src/a.ts", "src/aXts", false],
  ])("%s against %s is %s", (glob, path, expected) => {
    expect(matchesGlob(glob, path)).toBe(expected);
  });

  it("firstMatch names the first glob a path matches", () => {
    expect(firstMatch(["docs/**", "src/legacy/**", "src/**"], "src/legacy/a.ts")).toBe(
      "src/legacy/**",
    );
    expect(firstMatch(["docs/**"], "src/a.ts")).toBeUndefined();
  });
});
