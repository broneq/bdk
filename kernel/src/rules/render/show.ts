// Text mode of `rules show --ticket`: one heading for the ticket, then each
// section under its prompt key, as the agent reads it.
import type { TicketRules } from "../domain/report.ts";

export function renderTicketRules(rules: TicketRules): string {
  const heading = `## BDK rules: ${rules.ticket} (${rules.role}, ${rules.target})\n`;
  if (rules.sections.length === 0) return `${heading}\nNo rules for the role ${rules.role}.\n`;
  return [
    heading,
    ...rules.sections.map((section) => `### ${section.key}\n\n${section.text}`),
  ].join("\n");
}
