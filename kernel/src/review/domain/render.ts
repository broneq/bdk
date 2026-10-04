// What `bdk review render` answers (`kernel-cli/review`; T42-H, J).

export interface RenderResult {
  /** null for the pull request page, which reads no Change. */
  readonly change: string | null;
  readonly format: "html" | "md";
  /** Relative to the project root when inside it, absolute otherwise. */
  readonly path: string;
  /** null for the pull request page. */
  readonly range: string | null;
  /** The Decisions entries without a disposition; every finding id on the pull request page. */
  readonly undecided: readonly string[];
  readonly decided: readonly string[];
  readonly tracker: "github" | "instruction" | null;
}
