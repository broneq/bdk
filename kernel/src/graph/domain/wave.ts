// The execute wave `bdk next` returns with an `execute-part` node (T41-D3;
// `kernel-cli/graph`, bdk next): every ready part, whether it is started, its
// open `part` and `verify-fix` tickets, and where it works (T45). Every part
// runs as one `part` ticket (#166). Pure, so the rules have unit tests of
// their own.
import type { Graph } from "./engine.ts";

export interface WaveItem {
  readonly part: string;
  readonly started: boolean;
  /** Open `part` and `verify-fix` tickets of the part, oldest first. */
  readonly tickets: readonly string[];
  /** The part's `isolation`, `shared` when absent (T45). */
  readonly isolation: "shared" | "worktree";
  /** The absolute path of a live worktree part's worktree. */
  readonly workdir?: string | undefined;
}

export interface WaveInput {
  readonly graph: Graph;
  /** The `Files:` of every task of each part. */
  readonly files: ReadonlyMap<string, readonly string[]>;
  /** The first path of `own` that touches a path of `other`, or undefined. */
  readonly overlap: (own: readonly string[], other: readonly string[]) => string | undefined;
  /** Parts with a kernel transition to their `execute-part` instance. */
  readonly started: ReadonlySet<string>;
  /** Open tickets, oldest first: the loop and the target. */
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
  return ready.map((part) => {
    const own = input.tickets.filter(
      ({ loop, target }) => target === part && (loop === "part" || loop === "verify-fix"),
    );
    const workdir = input.live.get(part);
    return {
      part,
      started: input.started.has(part),
      tickets: own.map(({ ticket }) => ticket),
      isolation: isolationOf(part),
      ...(workdir === undefined ? {} : { workdir }),
    };
  });
}
