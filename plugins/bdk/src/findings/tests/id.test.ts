import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { dedupeKey, findingId, normalise } from "../domain/id.ts";

// Spec `bdk-cli/findings`, "Finding id and dedupe key".

describe("normalise", () => {
  it("folds case, Unicode forms, punctuation and spacing", () => {
    expect(normalise("  Missing null check!")).toBe("missing null check");
    expect(normalise("missing \t null-check")).toBe("missing null check");
    expect(normalise("ﬁle Łódź №5")).toBe("file łódź no5");
  });
});

describe("dedupeKey", () => {
  it("joins file, line and the rule with U+001F", () => {
    expect(dedupeKey({ file: "src/a.ts", line: 12, rule: "no-any", summary: "x" })).toBe(
      "src/a.ts\u001f12\u001frule:no-any",
    );
  });

  it("uses the normalised summary without a rule and empty parts for an absent file", () => {
    expect(dedupeKey({ summary: "Login fails!" })).toBe("\u001f\u001fsummary:login fails");
  });
});

describe("findingId", () => {
  it("is f- and the first 12 hex characters of the SHA-256 of the key", () => {
    const finding = { file: "src/a.ts", line: 12, rule: "no-any", summary: "x" };
    const hash = createHash("sha256").update(dedupeKey(finding)).digest("hex");
    expect(findingId(finding)).toBe(`f-${hash.slice(0, 12)}`);
    expect(findingId(finding)).toMatch(/^f-[0-9a-f]{12}$/);
  });

  it("is the same for the same rule on the same line with different summaries", () => {
    expect(findingId({ file: "src/a.ts", line: 12, rule: "no-any", summary: "one" })).toBe(
      findingId({ file: "src/a.ts", line: 12, rule: "no-any", summary: "two" }),
    );
  });

  it("is the same for summaries that normalise alike without a rule", () => {
    expect(findingId({ file: "src/a.ts", summary: "Missing null check!" })).toBe(
      findingId({ file: "src/a.ts", summary: "missing  null check" }),
    );
  });

  it("differs for a different rule, line or file", () => {
    const base = { file: "src/a.ts", line: 12, rule: "no-any", summary: "x" };
    const ids = new Set([
      findingId(base),
      findingId({ ...base, rule: "no-eval" }),
      findingId({ ...base, line: 13 }),
      findingId({ ...base, file: "src/b.ts" }),
      findingId({ file: "src/a.ts", line: 12, summary: "rule:no-any" }),
    ]);
    expect(ids.size).toBe(5);
  });
});
