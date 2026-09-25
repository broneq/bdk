import { describe, expect, it } from "vitest";

import { ID_PREFIXES, newId, parseReference } from "../index.ts";

describe("newId", () => {
  it.each(ID_PREFIXES)("starts with %s and continues in base36", (prefix) => {
    expect(newId(prefix)).toMatch(new RegExp(`^${prefix}[0-9a-z]{5}$`));
  });

  it("draws from the injected random source", () => {
    expect(newId("L-", () => 0)).toBe("L-00000");
    expect(newId("A-", () => 0.999999)).toBe("A-zzzzz");
  });

  it("draws one base36 digit per character", () => {
    const draws = [0, 10 / 36, 35 / 36, 0.5, 1 / 36];
    expect(newId("E-", () => draws.shift() ?? 0)).toBe("E-0azi1");
  });
});

describe("parseReference", () => {
  it("reads a bare id", () => {
    expect(parseReference("L-m2x9v")).toStrictEqual({ id: "L-m2x9v" });
  });

  it("reads a qualified id", () => {
    expect(parseReference("add-auth/L-m2x9v")).toStrictEqual({
      changeId: "add-auth",
      id: "L-m2x9v",
    });
  });

  it.each(["", "L-", "X-abc", "L-ABC", "/L-m2x9v", "a/b/L-m2x9v", "add auth/L-m2x9v", "add-auth/"])(
    "rejects %j",
    (text) => {
      expect(parseReference(text)).toBeUndefined();
    },
  );
});
