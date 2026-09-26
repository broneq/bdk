// The Markdown of a composed context: one `##` heading, then one `###`
// section per part, each body ending in exactly one newline.
import type { ComposedContext, ContextReport } from "../domain/report.ts";

export function renderContext({ heading, sections }: ComposedContext): ContextReport {
  const blocks = sections.map(({ title, body }) => `### ${title}\n\n${body.trimEnd()}\n`);
  return {
    content: [`## ${heading}\n`, ...blocks].join("\n"),
    parts: sections.map((section) => section.part),
  };
}
