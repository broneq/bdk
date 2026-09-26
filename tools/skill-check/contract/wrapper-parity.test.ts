// The `!` wrapper form and its `allowed-tools` pair live in two places: the
// kernel-cli spec (Invocation) and the constants the `bdk/wrapper-*` rules
// apply. A spec edit without a plugin edit must fail here (spec `skill-content-checks`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { CONTENT_WRAPPER_PATTERN, KERNEL_TOOL_RULES } from "../bdk-rules.ts";

const SPEC = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "openspec", "specs", "kernel-cli", "spec.md"),
  "utf8",
);

it("bdk/wrapper-form applies the content-wrapper regex of the kernel-cli spec", () => {
  const block = /^```regex content-wrapper\n(.*)\n```$/m.exec(SPEC);
  expect(block, "the spec has a ```regex content-wrapper block").not.toBeNull();
  expect(CONTENT_WRAPPER_PATTERN).toBe(block?.[1]);
});

it("bdk/wrapper-allowed-tools requires the allowed-tools pair of the kernel-cli spec", () => {
  const pair = /SHALL carry `allowed-tools: ([^`]+)`/.exec(SPEC);
  expect(pair, "the spec names the allowed-tools pair").not.toBeNull();
  expect(KERNEL_TOOL_RULES.join(" ")).toBe(pair?.[1]);
});
