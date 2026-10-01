// The execute wave `bdk next` returns with an `execute-part` node (T41-D3;
// `kernel-cli/graph`, bdk next): every ready part, whether it is started, its
// open tickets and whether it runs flat (main dispatches its tasks) or as a
// tree (one lead per part). Pure, so the mode rule has unit tests of its own.
import type { Graph } from "./engine.ts";

type WaveMode = "flat" | "tree";

export interface WaveItem {
  readonly part: string;
  readonly started: boolean;
  /** Open tickets of the part, or of one of its tasks, oldest first. */
  readonly tickets: readonly string[];
  readonly mode: WaveMode;
}

export interface WaveInput {
  readonly graph: Graph;
  readonly profile: string;
  readonly tree: { readonly enabled: boolean; readonly "min-parts": number };
  /** Parts with a kernel transition to their `execute-part` instance. */
  readonly started: ReadonlySet<string>;
  /** Open tickets, oldest first: the loop and the target, a part or a task id. */
  readonly tickets: readonly {
    readonly ticket: string;
    readonly loop: string;
    readonly target: string;
  }[];
}

const KIND = "execute-part";

/**
 * A part with an open `part-lead` ticket is `tree`; another started part is
 * `flat`; a part not started is `tree` when the Change is `large`, the tree is
 * enabled and the ready parts not started number at least `min-parts`.
 */
export function executeWave(input: WaveInput): WaveItem[] {
  const ready = input.graph.nodes.flatMap((node) =>
    node.kind === KIND &&
    node.nn !== undefined &&
    !node.sealed &&
    (node.state === "ready" || node.state === "stale")
      ? [node.nn]
      : [],
  );
  const fresh = ready.filter((nn) => !input.started.has(nn)).length;
  const tree = input.profile === "large" && input.tree.enabled && fresh >= input.tree["min-parts"];
  return ready.map((part) => {
    const own = input.tickets.filter(
      ({ target }) => target === part || target.startsWith(`${part}-`),
    );
    const started = input.started.has(part);
    const lead = own.some(({ loop }) => loop === "part-lead");
    return {
      part,
      started,
      tickets: own.map(({ ticket }) => ticket),
      mode: lead || (!started && tree) ? "tree" : "flat",
    };
  });
}
