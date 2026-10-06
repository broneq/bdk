// Text mode of `rules show`: one rule with its frontmatter, or one heading for
// the ticket or the role and files, then each rule as `- [<id>] <text>` as the
// agent reads it.
import type { OneRule, RoleRules, ShownRule, TicketRules } from "../domain/report.ts";

export function renderTicketRules(rules: TicketRules): string {
  return ruleList(`${rules.ticket} (${rules.role}, ${rules.target})`, rules.role, rules.rules);
}

export function renderRoleRules(rules: RoleRules): string {
  return ruleList(`${rules.role} (${rules.files.join(", ")})`, rules.role, rules.rules);
}

function ruleList(title: string, role: string, rules: readonly ShownRule[]): string {
  const heading = `## BDK rules: ${title}\n`;
  if (rules.length === 0) return `${heading}\nNo rules for the role ${role}.\n`;
  const lines = rules.map((rule) => {
    const matched = rule.matchedBy === null ? "" : ` (matched by ${rule.matchedBy})`;
    return `- [${rule.id}] ${rule.text}${matched}`;
  });
  return `${heading}\n${lines.join("\n")}\n`;
}

export function renderRule(rule: OneRule): string {
  const fields: [string, string | undefined][] = [
    ["file", rule.file],
    ["kind", rule.kind],
    ["severity", rule.severity],
    ["paths", rule.paths.join(", ")],
    ["stages", rule.stages.join(", ")],
    ["origin", rule.origin],
    ["evidence", rule.evidence?.join(", ")],
    ["since", rule.since],
    ["source", rule.source],
    ["verified", rule.verified],
    ["removed", rule.removed],
    ["disabled", rule.disabled ? "true" : undefined],
  ];
  const shown = fields.flatMap(([key, value]) => (value === undefined ? [] : [`${key}: ${value}`]));
  return `## ${rule.id}\n\n${shown.join("\n")}\n\n${rule.text}\n`;
}
