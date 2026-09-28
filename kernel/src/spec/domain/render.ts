// The canonical living spec file (`kernel-state`, Living spec file; T30-D5,
// D6): title, Purpose, Requirements, blocks one blank line apart, LF, one
// final newline; the frontmatter holds the body's hash and the last Change.
import { blockText } from "./grammar.ts";
import type { Requirement } from "./grammar.ts";

export interface SpecContent {
  readonly purpose: string;
  readonly requirements: readonly Requirement[];
}

export function renderBody(capability: string, content: SpecContent): string {
  const parts = [
    `# ${capability} Specification`,
    "## Purpose",
    content.purpose,
    "## Requirements",
    ...content.requirements.map(blockText),
  ];
  return `${parts.join("\n\n")}\n`;
}

/** The file: exactly the two frontmatter keys, in order, then the body. */
export function renderFile(body: string, hash: string, change: string): string {
  return `---\nbdk-merge-hash: ${hash}\nbdk-change: ${change}\n---\n${body}`;
}
