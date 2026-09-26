// The one serialisation of a state document: YAML frontmatter in the key order
// of `data`, never folded, then the body as given. Deterministic, so a
// regenerated file has the same bytes on every branch.
import { stringify } from "yaml";

export function renderDocument(data: Readonly<Record<string, unknown>>, body: string): string {
  return `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`;
}
