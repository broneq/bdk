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
  /** The `Files:` of every task of each part. */
  readonly files: ReadonlyMap<string, readonly string[]>;
  /** The first path of `own` that touches a path of `other`, or undefined. */
  readonly overlap: (own: readonly string[], other: readonly string[]) => string | undefined;
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
 * Parts share one working tree, so a part not started whose `Files:` overlap
 * a started part or a part listed before it waits for a later wave.
 */
export function executeWave(input: WaveInput): WaveItem[] {
  const candidates = input.graph.nodes.flatMap((node) =>
    node.kind === KIND &&
    node.nn !== undefined &&
    !node.sealed &&
    (node.state === "ready" || node.state === "stale")
      ? [node.nn]
      : [],
  );
  const filesOf = (part: string) => input.files.get(part) ?? [];
  const claimed = candidates.filter((nn) => input.started.has(nn)).flatMap(filesOf);
  const ready = candidates.filter((nn) => {
    if (input.started.has(nn)) return true;
    if (input.overlap(filesOf(nn), claimed) !== undefined) return false;
    claimed.push(...filesOf(nn));
    return true;
  });
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
