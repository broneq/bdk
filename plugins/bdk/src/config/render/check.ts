// Text of `bdk config check` (spec `bdk-cli/config`, "config check"): one problem per line.

import { describeProblem } from "../domain/validate.ts";
import type { CheckResult } from "../schema/check.ts";

export function renderCheck(result: CheckResult): string {
  const files = result.layers.filter((file) => file.present).length;
  if (result.problems.length === 0) {
    return `configuration valid: ${files} layer file${files === 1 ? "" : "s"} checked`;
  }
  const count = result.problems.length;
  return [
    `configuration invalid: ${count} problem${count === 1 ? "" : "s"}`,
    ...result.problems.map((problem) => describeProblem(problem, result.root)),
  ].join("\n");
}
