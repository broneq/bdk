// Change files are YAML frontmatter plus Markdown (R-format). This only cuts
// the two apart; `state/documents.ts` parses and validates the documents.
// One blank line right after the closing `---` is the separator the kernel
// writes (`kernel-state`, Markdown document shape), not body, so a file
// written before that separator existed reads to the same body.

export interface Split {
  readonly frontmatter?: string;
  readonly body: string;
}

const BLOCK = /^---\r?\n(?<yaml>(?:.*\r?\n)*?)---(?:\r?\n(?:\r?\n)?|$)/;

export function splitFrontmatter(text: string): Split {
  const match = BLOCK.exec(text);
  const yaml = match?.groups?.yaml;
  if (match === null || yaml === undefined) return { body: text };
  return { frontmatter: yaml, body: text.slice(match[0].length) };
}
