import { describe, expect, it } from "vitest";

import { nulPaths, numstat, recordHead, roundNumbers } from "../domain/range.ts";

// Parsing and round choice of spec `bdk-cli/git`, "Scope of a review round", "Round record".

const SHA = "a".repeat(40);

describe("nulPaths", () => {
  it("splits, dedupes and sorts by code unit", () => {
    expect(nulPaths("b.ts\0B.ts\0a b\tc.ts\0b.ts\0")).toEqual(["B.ts", "a b\tc.ts", "b.ts"]);
    expect(nulPaths("")).toEqual([]);
  });
});

describe("numstat", () => {
  it("splits text and binary paths and keeps unusual characters", () => {
    const output =
      "3\t1\tsrc/z.ts\0-\t-\timg/logo.png\0" + "0\t0\tsrc/ząb\tx.ts\0" + "10\t0\tsrc/a.ts\0";
    expect(numstat(output)).toEqual({
      text: ["src/a.ts", "src/z.ts", "src/ząb\tx.ts"],
      binary: ["img/logo.png"],
    });
    expect(numstat("")).toEqual({ text: [], binary: [] });
  });
});

describe("roundNumbers", () => {
  it("takes round-N directories, highest first", () => {
    expect(
      roundNumbers([
        { name: "round-1", dir: true },
        { name: "round-10", dir: true },
        { name: "round-2", dir: true },
        { name: "round-3", dir: false },
        { name: "round-02", dir: true },
        { name: "round-0", dir: true },
        { name: "notes", dir: true },
      ]),
    ).toEqual([10, 2, 1]);
  });
});

describe("recordHead", () => {
  it("is the head of a valid record", () => {
    expect(recordHead(JSON.stringify({ head: SHA, groups: [] }))).toBe(SHA);
    expect(recordHead(JSON.stringify({ head: "b".repeat(64) }))).toBe("b".repeat(64));
  });

  it("is undefined for invalid JSON, no head or a head that is no full object name", () => {
    expect(recordHead("{")).toBeUndefined();
    expect(recordHead("null")).toBeUndefined();
    expect(recordHead(JSON.stringify({ error: { code: "env/x" } }))).toBeUndefined();
    expect(recordHead(JSON.stringify({ head: "abc1234" }))).toBeUndefined();
    expect(recordHead(JSON.stringify({ head: SHA.toUpperCase() }))).toBeUndefined();
  });
});
