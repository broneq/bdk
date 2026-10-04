// The Markdown of `bdk ctx craft`: the skill under `## Craft: <name>`, its
// headings one level down, then each reference under its own `###` heading,
// so the agent gets what the skill links without resolving a path.
import { demoteHeadings } from "../domain/markdown.ts";
import type { ContextReport, CraftSkill } from "../domain/report.ts";

export function renderCraft({ name, body, references }: CraftSkill): ContextReport {
  const blocks = [
    `## Craft: ${name}\n\n${demoteHeadings(body.trim())}\n`,
    ...references.map(
      ({ file, text }) => `### references/${file}\n\n${demoteHeadings(text.trim(), 3)}\n`,
    ),
  ];
  return { content: blocks.join("\n"), parts: [{ kind: "craft", source: `bdk-craft/${name}` }] };
}
