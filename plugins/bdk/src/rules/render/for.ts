// The text of `bdk rules for`: Markdown a skill puts into a role's prompt as it is (design D10).

import type { ForResult } from "../schema/for.ts";

type Selected = ForResult["rules"][number];

function where(rule: Selected, files: readonly string[]): string {
  if (files.length === 0) return "applies to any file of the stage";
  return `applies to ${rule.matched.join(", ")}`;
}

function about(rule: Selected, files: readonly string[]): string {
  const facts: string[] = [rule.kind];
  if (rule.verified !== null) facts.push(`verified ${rule.verified}`);
  if (rule.source !== null) facts.push(`source ${rule.source}`);
  return `${facts.join(", ")}; ${where(rule, files)}`;
}

export function renderFor(result: ForResult): string {
  const count = (n: number, noun: string): string => `${String(n)} ${noun}${n === 1 ? "" : "s"}`;
  const scope = result.files.length === 0 ? "" : `, ${count(result.files.length, "file")}`;
  const lines = [
    `BDK rules for stage ${result.stage}: ${count(result.rules.length, "rule")}${scope}`,
  ];
  for (const rule of result.rules) {
    lines.push("", `## ${rule.id}`, about(rule, result.files), "", rule.text);
  }
  if (result.warnings.length > 0) {
    lines.push("", "warnings:", ...result.warnings.map((warning) => `  ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}
