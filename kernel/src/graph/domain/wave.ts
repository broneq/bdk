// The execute wave `bdk next` returns with an `execute-part` node (T41-D3;
// `kernel-cli/graph`, bdk next): every ready part, whether it is started, its
// open tickets, whether it runs flat (main dispatches its tasks) or as a
// tree (one lead per part), and where it works (T45). Pure, so the rules have
// unit tests of their own.
import type { Graph } from "./engine.ts";

type WaveMode = "flat" | "tree";

export interface WaveItem {
  readonly part: string;
  readonly started: boolean;
  /** Open tickets of the part, or of one of its tasks, oldest first. */
  readonly tickets: readonly string[];
  readonly mode: WaveMode;
  /** The part's `isolation`, `shared` when absent (T45). */
  readonly isolation: "shared" | "worktree";
  /** The absolute path of a live worktree part's worktree. */
  readonly workdir?: string | undefined;
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
  /** Each part's `isolation`; a part missing here is `shared`. */
  readonly isolation: ReadonlyMap<string, "shared" | "worktree">;
  /** `execution.worktree`: whether worktrees are made, and the most live at once. */
  readonly worktree: { readonly enabled: boolean; readonly "max-live": number };
  /** The worktree of each live worktree part of this Change. */
  readonly live: ReadonlyMap<string, string>;
  /** The kernel worktrees of the project, every Change counted. */
  readonly liveCount: number;
}

const KIND = "execute-part";

/**
 * A part with an open `part-lead` ticket is `tree`; another started part is
 * `flat`; a part not started is `tree` when the Change is `large`, the tree is
 * enabled and the ready parts not started number at least `min-parts`.
 * Parts share one working tree, so a part not started whose `Files:` overlap
 * a started part or a part listed before it waits for a later wave. A
 * worktree runs no other part, so two isolation rules follow (T45): with
 * worktrees disabled, a worktree part not started runs alone in the shared
 * tree, and nothing new joins it while it runs; at `max-live` worktrees, a
 * worktree part not started waits.
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
  const isolationOf = (part: string) => input.isolation.get(part) ?? "shared";
  const isolated = (part: string) => isolationOf(part) === "worktree";
  const started = candidates.filter((nn) => input.started.has(nn));
  const claimed = started.flatMap(filesOf);
  // A worktree part started without its worktree holds the shared tree alone.
  let alone = started.some((nn) => isolated(nn) && !input.live.has(nn));
  let live = input.liveCount;
  let listed = started.length;
  const ready = candidates.filter((nn) => {
    if (input.started.has(nn)) return true;
    if (input.overlap(filesOf(nn), claimed) !== undefined) return false;
    if (alone) return false;
    if (isolated(nn)) {
      if (!input.worktree.enabled) {
        if (listed > 0) return false;
        alone = true;
      } else if (live >= input.worktree["max-live"]) {
        return false;
      } else {
        live += 1;
      }
    }
    claimed.push(...filesOf(nn));
    listed += 1;
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
    const workdir = input.live.get(part);
    return {
      part,
      started,
      tickets: own.map(({ ticket }) => ticket),
      mode: lead || (!started && tree) ? "tree" : "flat",
      isolation: isolationOf(part),
      ...(workdir === undefined ? {} : { workdir }),
    };
  });
}
