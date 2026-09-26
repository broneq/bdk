// What `ctx skill` and `ctx startup` answer: the composed Markdown and the
// parts it was built from, in output order.

type PartKind =
  "rules" | "language-rules" | "fragment" | "tools" | "file" | "startup" | "agents-table";

interface ContextPart {
  readonly kind: PartKind;
  /** The prompt key, `tools.<group>` or plugin path that produced the part. */
  readonly source: string;
}

export interface ContextReport {
  readonly content: string;
  readonly parts: readonly ContextPart[];
}

/** One `###` section of a composed context. */
export interface Section {
  readonly title: string;
  readonly body: string;
  readonly part: ContextPart;
}

/** A skill's context before rendering: its heading and sections in order. */
export interface ComposedContext {
  readonly heading: string;
  readonly sections: readonly Section[];
}

/** One row of the STARTUP agents table, from an agent file's frontmatter. */
export interface AgentRow {
  readonly name: string;
  readonly model: string;
  readonly description: string;
}

/** STARTUP_INSTRUCTIONS.md cut at the agents-table markers, which stay in `before` and `after`. */
export interface StartupSource {
  readonly before: readonly string[];
  readonly rows: readonly AgentRow[];
  readonly after: readonly string[];
}
