// The one serialisation of a state document: YAML frontmatter in the key order
// of `data`, never folded, then the body as given. Deterministic, so a
// regenerated file has the same bytes on every branch. A `flow` document
// writes its sequences on one line each, so the report envelope an agent
// returns stays within 15 lines (`kernel-state`, Report envelope).
// The bytes are what Prettier's defaults produce (`kernel-state`, Markdown
// document shape): one blank line before a non-empty body, which ends with a
// newline, and flow sequences without inner padding; the contract test
// `markdown-prettier` holds every kernel Markdown kind to it.
import { Document, stringify, visit } from "yaml";

export type RenderStyle = "block" | "flow";

export function renderDocument(
  data: Readonly<Record<string, unknown>>,
  body: string,
  style: RenderStyle = "block",
): string {
  return frontmatterFile(frontmatter(data, style), body);
}

/** YAML text (ending in a newline) and a body joined in the document shape; for frontmatter not built from data. */
export function frontmatterFile(yaml: string, body: string): string {
  return `---\n${yaml}---\n${separated(body)}`;
}

function frontmatter(data: Readonly<Record<string, unknown>>, style: RenderStyle): string {
  if (style === "block") return stringify(data, { lineWidth: 0 });
  const document = new Document(data);
  visit(document, {
    Seq(_, node) {
      node.flow = true;
    },
  });
  return document.toString({ lineWidth: 0, flowCollectionPadding: false });
}

function separated(body: string): string {
  if (body === "") return "";
  return `\n${body}${body.endsWith("\n") ? "" : "\n"}`;
}
