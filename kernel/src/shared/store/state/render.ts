// The one serialisation of a state document: YAML frontmatter in the key order
// of `data`, never folded, then the body as given. Deterministic, so a
// regenerated file has the same bytes on every branch. A `flow` document
// writes its sequences on one line each, so the report envelope an agent
// returns stays within 15 lines (`kernel-state`, Report envelope).
import { Document, stringify, visit } from "yaml";

export type RenderStyle = "block" | "flow";

export function renderDocument(
  data: Readonly<Record<string, unknown>>,
  body: string,
  style: RenderStyle = "block",
): string {
  if (style === "block") return `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`;
  const document = new Document(data);
  visit(document, {
    Seq(_, node) {
      node.flow = true;
    },
  });
  return `---\n${document.toString({ lineWidth: 0 })}---\n${body}`;
}
