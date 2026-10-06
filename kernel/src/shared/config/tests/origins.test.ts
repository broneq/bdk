import { describe, expect, it } from "vitest";

import { keyOrigin } from "../index.ts";

describe("keyOrigin", () => {
  const origins = {
    "policy.gates.review": "project",
    "review.risks.secrets.enabled": "project",
    "review.risks.billing.instruction": "local",
    languages: "global",
  } as const;

  it("returns the key's own origin", () => {
    expect(keyOrigin(origins, "policy.gates.review")).toBe("project");
  });

  it("falls back to an ancestor that replaced the value whole", () => {
    expect(keyOrigin(origins, "languages.0")).toBe("global");
  });

  it("takes the highest layer below the key for a merged id array", () => {
    expect(keyOrigin(origins, "review.risks")).toBe("local");
  });

  it("is default when no file set the key", () => {
    expect(keyOrigin(origins, "policy.gates.design")).toBe("default");
    expect(keyOrigin(origins, "review.risk")).toBe("default");
  });
});
