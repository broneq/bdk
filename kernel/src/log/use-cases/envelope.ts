// The report on `log ingest` stdin (`kernel-cli/log`; T23-D26): the YAML
// frontmatter as fields with the input line of each key, then the body. Line
// numbers count the whole input, so line 1 is the opening `---`.
import { isMap, isScalar, LineCounter, parseDocument } from "yaml";
import type { Node, Pair } from "yaml";

import { splitFrontmatter } from "../../shared/store/index.ts";

export interface Envelope {
  readonly fields: Readonly<Record<string, unknown>>;
  /** The input line of each field's key. */
  readonly lines: Readonly<Record<string, number>>;
  /** The input line of the closing `---`. */
  readonly end: number;
  readonly body: string;
}

/** The report's envelope and body, or why the input holds no readable frontmatter. */
export function readEnvelope(input: string): Envelope | { readonly invalid: string } {
  const split = splitFrontmatter(input);
  if (split.frontmatter === undefined) {
    return {
      invalid:
        "the report has no frontmatter; it opens with a --- line, the envelope fields and a closing --- line",
    };
  }
  const counter = new LineCounter();
  const document = parseDocument(split.frontmatter, {
    lineCounter: counter,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const lineAt = (offset: number) => counter.linePos(offset).line + 1;
  const end = split.frontmatter.split("\n").length + 1;
  const [error] = document.errors;
  if (error !== undefined) {
    return {
      invalid: `line ${String(lineAt(error.pos[0]))}: ${error.message.split("\n")[0] ?? ""}`,
    };
  }
  const root = document.contents;
  if (root === null) return { fields: {}, lines: {}, end, body: split.body };
  if (!isMap(root)) {
    return { invalid: "line 2: the frontmatter is not a mapping of envelope fields" };
  }
  const lines: Record<string, number> = {};
  for (const pair of root.items as Pair[]) {
    const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    lines[key] = lineAt((pair.key as Node).range?.[0] ?? 0);
  }
  const fields = document.toJS() as Record<string, unknown>;
  return { fields, lines, end, body: split.body };
}
