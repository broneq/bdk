import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { findingFingerprint, fingerprint, learningFingerprint, normalise } from "../fingerprint.ts";

describe("normalise", () => {
  it.each([
    ["Scoped Test Runs", "scoped test runs"],
    ["  a,  b;\tc!  ", "a b c"],
    ["line 42 and 7 of 300", "line # and # of #"],
    ["v2.10.3", "v# # #"],
    ["ｆｕｌｌｗｉｄｔｈ", "fullwidth"],
    ["ﬁle", "file"],
    ["Zażółć gęślą jaźń", "zażółć gęślą jaźń"],
    ["Проверка: тест", "проверка тест"],
    ["already #1", "already ##"],
    ["", ""],
  ])("normalises %j to %j", (text, expected) => {
    expect(normalise(text)).toBe(expected);
  });
});

describe("fingerprint", () => {
  it("is sha256 over the parts joined by U+001F", () => {
    const expected = createHash("sha256").update("a\u001fb").digest("hex");
    expect(fingerprint(["a", "b"])).toBe(`sha256:${expected}`);
    expect(fingerprint(["a"])).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("keeps part boundaries", () => {
    expect(fingerprint(["a b", "c"])).not.toBe(fingerprint(["a", "b c"]));
  });

  it("gives cosmetic variants of a learning the same fingerprint", () => {
    expect(learningFingerprint("Scoped test runs must include the negative case (line 42)")).toBe(
      learningFingerprint("scoped test-runs MUST include the negative case, line 7!"),
    );
  });

  it("separates a learning from a finding with the same text", () => {
    expect(learningFingerprint("x")).toBe(fingerprint(["learning", "x"]));
    expect(learningFingerprint("x")).not.toBe(findingFingerprint("finding", "x", undefined, ""));
  });

  it("builds a finding from type, file, symbol and the normalised problem", () => {
    expect(
      findingFingerprint("finding", "src/a.ts", "verifyLink", "Expired token ACCEPTED at 60 s"),
    ).toBe(
      fingerprint([
        "finding",
        "finding",
        "src/a.ts",
        "verifyLink",
        "expired token accepted at # s",
      ]),
    );
    expect(findingFingerprint("finding", "src/a.ts", undefined, "x")).toBe(
      fingerprint(["finding", "finding", "src/a.ts", "", "x"]),
    );
  });
});
