import type * as Crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { ID_PREFIXES, isChangeId, newId, parseReference } from "../index.ts";

vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof Crypto>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});

describe("newId", () => {
  it.each(ID_PREFIXES)("starts with %s and continues with eight base36 characters", (prefix) => {
    expect(newId(prefix)).toMatch(new RegExp(`^${prefix}[0-9a-z]{8}$`));
  });

  it("draws from node:crypto by default", async () => {
    const { randomInt } = await import("node:crypto");
    vi.mocked(randomInt).mockClear();
    newId("L-");
    expect(randomInt).toHaveBeenCalledTimes(8);
    expect(randomInt).toHaveBeenCalledWith(36);
  });

  it("draws from the injected random source", () => {
    expect(newId("L-", () => 0)).toBe("L-00000000");
    expect(newId("A-", () => 0.999999)).toBe("A-zzzzzzzz");
  });

  it("draws one base36 digit per character", () => {
    const draws = [0, 10 / 36, 35 / 36, 0.5, 1 / 36, 2 / 36, 3 / 36, 4 / 36];
    expect(newId("E-", () => draws.shift() ?? 0)).toBe("E-0azi1234");
  });

  it("yields 10 000 distinct ids", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId("L-")));
    expect(ids.size).toBe(10_000);
  });
});

describe("isChangeId", () => {
  it.each(["2026-09-25-passwordless-login", "2026-01-01-a", `2026-09-25-${"a".repeat(40)}`])(
    "accepts %j",
    (text) => {
      expect(isChangeId(text)).toBe(true);
    },
  );

  it.each([
    "passwordless-login",
    "2026-9-25-login",
    "2026-09-25-",
    "2026-09-25-Login",
    "2026-09-25-login--flow",
    "2026-09-25-login-",
    `2026-09-25-${"a".repeat(41)}`,
  ])("rejects %j", (text) => {
    expect(isChangeId(text)).toBe(false);
  });
});

describe("parseReference", () => {
  it("reads a bare id", () => {
    expect(parseReference("L-m2x9v7qa")).toStrictEqual({ id: "L-m2x9v7qa" });
  });

  it("reads a qualified id", () => {
    expect(parseReference("2026-09-25-passwordless-login/L-m2x9v7qa")).toStrictEqual({
      changeId: "2026-09-25-passwordless-login",
      id: "L-m2x9v7qa",
    });
  });

  it.each([
    "",
    "L-",
    "X-m2x9v7qa",
    "L-m2x9v7q",
    "L-m2x9v7qab",
    "L-M2X9V7QA",
    "/L-m2x9v7qa",
    "a/b/L-m2x9v7qa",
    "add-auth/L-m2x9v7qa",
    "2026-09-25-login/",
  ])("rejects %j", (text) => {
    expect(parseReference(text)).toBeUndefined();
  });
});
