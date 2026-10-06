// A rule file for tests (`kernel-state`, Rule file frontmatter). A test states
// the fields it is about; the rest default to a house rule of every file and
// every stage.
import { RULE_STAGES } from "../../src/shared/vocabulary/index.ts";

export interface RuleFileFields {
  readonly origin?: string;
  readonly paths?: readonly string[];
  readonly stages?: readonly string[];
  /** Further frontmatter lines, each ending in a newline. */
  readonly extra?: string;
  readonly text?: string;
}

export function ruleFile(id: string, fields: RuleFileFields = {}): string {
  const {
    origin = "user",
    paths = ["**"],
    stages = RULE_STAGES,
    extra = "",
    text = `Text of ${id}.`,
  } = fields;
  return [
    "---",
    "schema: 1",
    `id: ${id}`,
    "kind: house",
    `paths: ${JSON.stringify(paths)}`,
    `stages: [${stages.join(", ")}]`,
    "severity: medium",
    `origin: ${origin}`,
    "since: 2026-09-30",
    `${extra}---`,
    "",
    text,
    "",
  ].join("\n");
}
