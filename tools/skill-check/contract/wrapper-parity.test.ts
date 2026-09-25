// The `!` wrapper form lives in two places: the `content-wrapper` block of the
// kernel-cli spec (Invocation) and the constant `bdk/wrapper-form` applies. A
// spec edit without a plugin edit must fail here (spec `skill-content-checks`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { CONTENT_WRAPPER_PATTERN } from "../bdk-rules.ts";

const SPEC = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "openspec",
  "specs",
  "kernel-cli",
  "spec.md",
);

it("bdk/wrapper-form applies the content-wrapper regex of the kernel-cli spec", () => {
  const block = /^```regex content-wrapper\n(.*)\n```$/m.exec(readFileSync(SPEC, "utf8"));
  expect(block, "the spec has a ```regex content-wrapper block").not.toBeNull();
  expect(CONTENT_WRAPPER_PATTERN).toBe(block?.[1]);
});
