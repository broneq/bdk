// The `mermaid` blocks of a page, with the line each starts on (spec `docs-site`, "Mermaid blocks
// parse"). The parse test runs every block through mermaid's own parser.

export interface MermaidBlock {
  /** Line of the opening fence, from 1. */
  readonly line: number;
  readonly code: string;
}

export function mermaidBlocks(page: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const lines = page.split("\n");
  let open: { line: number; code: string[] } | undefined;
  let otherFence = false;
  for (const [index, text] of lines.entries()) {
    const fence = /^\s*```(\w*)/.exec(text);
    if (fence === null) {
      open?.code.push(text);
      continue;
    }
    if (open !== undefined) {
      blocks.push({ line: open.line, code: open.code.join("\n") });
      open = undefined;
    } else if (otherFence) {
      otherFence = false;
    } else if (fence[1] === "mermaid") {
      open = { line: index + 1, code: [] };
    } else {
      otherFence = true;
    }
  }
  return blocks;
}
