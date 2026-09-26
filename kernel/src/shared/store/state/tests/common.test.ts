import { describe, expect, it } from "vitest";
import * as z from "zod";

import {
  changeId,
  date,
  evidenceId,
  hash,
  idReference,
  ledgerId,
  provenance,
  relativePath,
  ticketId,
  timestamp,
} from "../common.ts";

describe("ids", () => {
  it.each([
    [ledgerId, "L-m2x9v7qa", ["A-m2x9v7qa", "L-m2x9v7q", "L-M2X9V7QA"]],
    [ticketId, "A-7f3kx2p9", ["L-7f3kx2p9", "A-7f3kx2p9x"]],
    [evidenceId, "E-5hq0m2vd", ["A-5hq0m2vd", "E-5hq0"]],
  ] as const)("accepts only its own prefix and length", (schema, good, bad) => {
    expect(schema.safeParse(good).success).toBe(true);
    for (const text of bad) expect(schema.safeParse(text).success).toBe(false);
  });

  it("accepts a Change id of at most 40 slug characters", () => {
    expect(changeId.safeParse("2026-09-25-passwordless-login").success).toBe(true);
    expect(changeId.safeParse(`2026-09-25-${"a".repeat(41)}`).success).toBe(false);
    expect(changeId.safeParse("passwordless-login").success).toBe(false);
  });

  it.each(["L-m2x9v7qa", "A-7f3kx2p9", "2026-09-25-passwordless-login/L-m2x9v7qa"])(
    "accepts the reference %j",
    (text) => {
      expect(idReference.safeParse(text).success).toBe(true);
    },
  );

  it.each(["L-m2x9v7q", "add-auth/L-m2x9v7qa", "2026-09-25-login/", "a/b/L-m2x9v7qa"])(
    "rejects the reference %j",
    (text) => {
      expect(idReference.safeParse(text).success).toBe(false);
    },
  );
});

describe("scalars", () => {
  it("takes a sha256 hash of 64 lower-case hex characters", () => {
    expect(hash.safeParse(`sha256:${"0f".repeat(32)}`).success).toBe(true);
    expect(hash.safeParse(`sha256:${"0F".repeat(32)}`).success).toBe(false);
    expect(hash.safeParse(`sha1:${"0".repeat(40)}`).success).toBe(false);
  });

  it("takes a UTC timestamp with seconds and nothing finer", () => {
    expect(timestamp.safeParse("2026-09-25T09:12:03Z").success).toBe(true);
    for (const text of [
      "2026-09-25T09:12Z",
      "2026-09-25T09:12:03.120Z",
      "2026-09-25T11:12:03+02:00",
    ]) {
      expect(timestamp.safeParse(text).success).toBe(false);
    }
  });

  it("takes a calendar date", () => {
    expect(date.safeParse("2026-09-26").success).toBe(true);
    expect(date.safeParse("2026-9-26").success).toBe(false);
  });

  it.each(["design.md", "src/auth/magic-link.ts", ".bdk/changes/x/evidence/a.xml"])(
    "accepts the relative path %j",
    (text) => {
      expect(relativePath.safeParse(text).success).toBe(true);
    },
  );

  it.each(["", "/etc/passwd", "src\\auth.ts", "../outside.md", "src/../../x", "./design.md"])(
    "rejects the path %j",
    (text) => {
      expect(relativePath.safeParse(text).success).toBe(false);
    },
  );

  it("stamps provenance as a fixed value or agent:<role>", () => {
    for (const text of ["user", "policy", "inferred", "kernel", "agent:plan-verifier"]) {
      expect(provenance.safeParse(text).success).toBe(true);
    }
    for (const text of ["agent:", "agent:Reviewer", "human"]) {
      expect(provenance.safeParse(text).success).toBe(false);
    }
  });

  it("never takes null for an optional field", () => {
    expect(z.strictObject({ at: timestamp.optional() }).safeParse({ at: null }).success).toBe(
      false,
    );
  });
});
