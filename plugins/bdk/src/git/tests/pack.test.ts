import { describe, expect, it } from "vitest";

import { moduleOf, pack, tolerance } from "../domain/pack.ts";

// Module packing of spec `bdk-cli/git`, "Review groups".

const many = (dir: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${dir}/f${String(i).padStart(3, "0")}.ts`);

const sizes = (groups: readonly (readonly string[])[]): number[] => groups.map((g) => g.length);

describe("moduleOf", () => {
  it("is the first two directory segments, or . at the root", () => {
    expect(moduleOf("src/auth/login.ts")).toBe("src/auth");
    expect(moduleOf("src/auth/deep/x.ts")).toBe("src/auth");
    expect(moduleOf("src/main.ts")).toBe("src");
    expect(moduleOf("README.md")).toBe(".");
  });
});

describe("tolerance", () => {
  it("is a third above the target, rounded down", () => {
    expect(tolerance(30)).toBe(40);
    expect(tolerance(1)).toBe(1);
    expect(tolerance(10)).toBe(13);
  });
});

describe("pack", () => {
  it("packs small modules up to the target", () => {
    const files = Array.from({ length: 44 }, (_, i) => `m${String(i).padStart(2, "0")}/x/a.ts`);
    expect(sizes(pack(files, 30))).toEqual([30, 14]);
  });

  it("keeps a module up to the tolerance whole", () => {
    expect(sizes(pack(many("src/big", 35), 30))).toEqual([35]);
  });

  it("starts a new group when the next module would pass the target", () => {
    const groups = pack([...many("a/one", 20), ...many("b/two", 20)], 30);
    expect(sizes(groups)).toEqual([20, 20]);
    expect(groups[0]?.every((f) => f.startsWith("a/one/"))).toBe(true);
  });

  it("cuts a large module by sub-directory", () => {
    const files = [...many("src/m/api", 30), ...many("src/m/db", 30), ...many("src/m/ui", 24)];
    const groups = pack(files, 30);
    expect(sizes(groups)).toEqual([30, 30, 24]);
    expect(groups.map((g) => g[0]?.split("/")[2])).toEqual(["api", "db", "ui"]);
  });

  it("cuts again by the next level while above the tolerance", () => {
    const files = [...many("src/m/api/a", 25), ...many("src/m/api/b", 25), ...many("src/m/db", 5)];
    expect(sizes(pack(files, 30))).toEqual([25, 30]);
  });

  it("cuts files directly in a directory into even runs of at most the target", () => {
    const groups = pack(many("src/flat", 50), 30);
    expect(sizes(groups)).toEqual([25, 25]);
    expect(groups.flat()).toEqual(many("src/flat", 50));
    expect(sizes(pack(many("src/flat", 61), 30))).toEqual([21, 20, 20]);
  });

  it("puts the files directly in a cut directory before its sub-directories", () => {
    const files = [...many("src/m", 45), ...many("src/m/zz", 3)];
    const groups = pack(files, 30);
    expect(sizes(groups)).toEqual([23, 25]);
    expect(groups[1]?.at(-1)).toBe("src/m/zz/f002.ts");
  });

  it("returns sorted files and no group for no files", () => {
    expect(pack([], 30)).toEqual([]);
    expect(pack(["b/x.ts", "a/y.ts", "a/x.ts"], 30)).toEqual([["a/x.ts", "a/y.ts", "b/x.ts"]]);
  });

  it("puts root files into module .", () => {
    expect(pack(["z.md", "src/a.ts"], 1)).toEqual([["z.md"], ["src/a.ts"]]);
  });
});
