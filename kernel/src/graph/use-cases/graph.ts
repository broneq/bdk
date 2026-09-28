// One read of a Change's graph: settings, pipeline, facts and files in, the
// derived node and gate states out. Every graph command and the `change`
// slice go through it, so they cannot disagree about a state.
import type { Graph, GraphNode } from "../domain/engine.ts";
import { evaluate } from "../domain/engine.ts";
import type { GatePolicy } from "../domain/gate.ts";
import { kindRegistry } from "../domain/kinds/index.ts";
import type { ChangeView, EvidenceFacts, KindRegistry, WorkFacts } from "../domain/kinds/index.ts";
import { stageMap } from "../domain/pipeline.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { gateView } from "../domain/reports.ts";
import type { GateView, PendingView } from "../domain/reports.ts";
import { gatesModule } from "../config.ts";
import { currentTrees, filePolicy } from "../../evidence/index.ts";
import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Resolved } from "../../shared/config/index.ts";
import { codeTreeHash, trailerCommits } from "../../shared/git/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  effectiveProfile,
  findChangeRow,
  isProfile,
  listEntries,
  openAttempts,
  parkedQuestion,
  readManifests,
  readPlanParts,
  stageOf,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import { inputHasher } from "./hash.ts";
import { loadPipeline } from "./pipeline.ts";
import { changeView } from "./view.ts";

export interface ChangeGraph {
  readonly graph: Graph;
  readonly view: ChangeView;
  readonly pipeline: Pipeline;
  readonly kinds: KindRegistry;
  readonly resolved: Resolved;
  readonly entries: readonly EntryRow[];
  readonly parked: EntryRow | undefined;
  /** The current hash of a node's inputs (all instances' for a collection); undefined for `none`. */
  currentHash(node: GraphNode): Promise<string | undefined>;
}

const shipped = kindRegistry();

export function kindsOf(deps: GraphDeps): KindRegistry {
  return deps.kinds ?? shipped;
}

export interface ReadOptions {
  /** Load the trailer commits and open tickets the `execute-part` checks read. */
  readonly work?: boolean;
}

/** The graph of a refreshed Change; `globalDir` locates the global settings layer. */
export async function readGraph(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  options: ReadOptions = {},
): Promise<ChangeGraph | Refusal> {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot: change.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  if ("refused" in resolved) return resolved;
  const kinds = kindsOf(deps);
  const pipeline = loadPipeline(deps.store, deps.pluginRoot, deps.settings, kinds);
  const row = findChangeRow(index, change.id);
  const entries = listEntries(index, change.id);
  const base = row !== undefined && isProfile(row.profile) ? row.profile : "small";
  const view = changeView({
    store: deps.store,
    id: change.id,
    dir: change.dir,
    projectRoot: change.projectRoot,
    kind: row?.kind ?? "feature",
    profile: effectiveProfile(base, entries),
    entries,
    ...(options.work === true ? { work: await workFacts(deps, change, index) } : {}),
    ...(await evidenceFacts(deps, change, resolved, options.work === true)),
  });
  const reviewed = pipeline.nodes.some((node) => {
    const kind = kinds.get(node.kind);
    return (
      kind !== undefined &&
      "codeTree" in kind.inputs(view) &&
      entries.some(
        (entry) => entry.type === "transition" && entry.source === "kernel" && entry.to === node.id,
      )
    );
  });
  const codeTree = reviewed ? await codeTreeHash(deps.git, change.projectRoot) : undefined;
  const hash = inputHasher(deps.store, change.dir, codeTree);
  const graph = evaluate({
    pipeline,
    kinds,
    view,
    features: record(resolved.value.features),
    gates: gatesOf(resolved),
    hash,
  });
  const currentHash = async (node: GraphNode): Promise<string | undefined> => {
    const kind = kinds.get(node.kind);
    if (kind === undefined) return undefined;
    const instances = (node.instances ?? []).map((id) => graph.find(id)?.nn);
    const inputs =
      instances.length === 0
        ? kind.inputs(view, node.nn)
        : {
            files: instances.flatMap((nn) => {
              const own = kind.inputs(view, nn);
              return "files" in own ? own.files : [];
            }),
          };
    if ("none" in inputs) return undefined;
    if ("codeTree" in inputs && codeTree === undefined) {
      return inputHasher(
        deps.store,
        change.dir,
        await codeTreeHash(deps.git, change.projectRoot),
      )(inputs);
    }
    return hash(inputs);
  };
  return {
    graph,
    view,
    pipeline,
    kinds,
    resolved,
    entries,
    parked: parkedQuestion(entries),
    currentHash,
  };
}

/**
 * The manifests with their freshness and the tree hash of every plan part,
 * through one work-tree listing; skipped while the Change has no manifest,
 * unless a validator reads the part trees.
 */
async function evidenceFacts(
  deps: GraphDeps,
  change: ActiveChange,
  resolved: Resolved,
  validating: boolean,
): Promise<{ evidence?: EvidenceFacts[]; partTrees?: ReadonlyMap<string, string> }> {
  const manifests = readManifests(deps.store, change.dir);
  if (manifests.length === 0 && !validating) return {};
  const parts = readPlanParts(deps.store, change.dir);
  const trees = await currentTrees(deps, change, filePolicy(resolved.value), parts, [
    ...parts.map((part) => part.id),
    ...manifests.map((manifest) => manifest.data.target),
  ]);
  return {
    evidence: manifests.map(({ data }) => ({
      id: data.id,
      kind: data.kind,
      target: data.target,
      at: data.at,
      verdict: data.verdict,
      cited: (data.citations ?? []).length > 0,
      fresh: trees.get(data.target)?.treeHash === data["tree-hash"],
    })),
    partTrees: new Map(parts.map((part) => [part.id, trees.get(part.id)?.treeHash ?? ""])),
  };
}

async function workFacts(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
): Promise<WorkFacts> {
  const commits = await trailerCommits(deps.git, change.projectRoot, change.id);
  return {
    commits: commits.flatMap(({ commit, part, task }) =>
      part === undefined || task === undefined ? [] : [{ commit, part, task }],
    ),
    openTickets: openAttempts(index, change.id).map(({ ticket, target }) => ({ ticket, target })),
  };
}

export function gatesOf(resolved: Resolved): Readonly<Record<string, GatePolicy>> {
  return moduleValue(gatesModule, resolved.value);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** The output view of a pending entry, from its index row. */
function pendingOf(read: ChangeGraph): (id: string) => PendingView {
  const rows = new Map(read.entries.map((entry) => [entry.id, entry]));
  return (id) => {
    const row = rows.get(id);
    if (row === undefined) throw new Error(`pending entry ${id} is not indexed`);
    return {
      id: row.id,
      type: row.type,
      summary: row.summary,
      status: row.status,
      source: row.source,
      author: row.author,
      at: row.at,
      refs: row.refs,
      ...(row.review ? { review: true } : {}),
      ...(row.supersedes === undefined ? {} : { supersedes: row.supersedes }),
    };
  };
}

/** The stage of the latest transition, through the pipeline (design D-12). */
export function stageOfChange(read: ChangeGraph): string {
  return stageOf(read.entries, stageMap(read.pipeline));
}

/** Every gate of the Change's graph as the outputs carry it. */
export function gateViews(read: ChangeGraph): GateView[] {
  const pending = pendingOf(read);
  return read.graph.gates.map((gate) => gateView(gate, pending));
}
