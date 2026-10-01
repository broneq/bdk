// `bdk agents list` and `bdk agents show` (`kernel-cli/agents`): the registry
// rows with their derived states; `--affected-by` resolves a ledger entry of
// the active Change and keeps the running agents whose target it names.
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  agentsRegistryPath,
  findEntry,
  readPlanParts,
  refreshChange,
  targetFiles,
  taskHolders,
  withIndex,
  withRegistry,
} from "../../shared/store/index.ts";
import { namesTarget, targetNames } from "../domain/affected.ts";
import type { AgentItem, AgentsListReport, AgentsShowReport } from "../domain/reports.ts";
import { AGENT_STATES } from "../domain/state.ts";
import type { AgentState, Lease } from "../domain/state.ts";

export { AGENT_STATES };
export type { AgentState };
import type { AgentsDeps } from "./deps.ts";
import { leaseOf, views } from "./registry.ts";
import type { AgentView } from "./registry.ts";

export interface Place {
  readonly projectRoot: string;
  readonly globalDir: string;
}

export interface ListFilters {
  readonly childrenOf?: string;
  readonly affectedBy?: string;
  readonly state?: AgentState;
  readonly all: boolean;
}

export async function listAgents(
  deps: AgentsDeps,
  place: Place,
  filters: ListFilters,
  change: () => ActiveChange | Refusal,
): Promise<AgentsListReport | Refusal> {
  const lease = leaseFor(deps, place);
  if ("refused" in lease) return lease;
  let affected: ((view: AgentView) => boolean) | undefined;
  if (filters.affectedBy !== undefined) {
    const active = change();
    if ("refused" in active) return active;
    const matcher = await affectedMatcher(deps, active, filters.affectedBy);
    if ("refused" in matcher) return matcher;
    affected = matcher.test;
  }
  const all = await registryViews(deps, place.projectRoot, lease);
  const agents = all.filter(
    (view) =>
      (filters.all || filters.state === "ended" || view.state !== "ended") &&
      (filters.state === undefined || view.state === filters.state) &&
      (filters.childrenOf === undefined || view.parent === filters.childrenOf) &&
      (affected === undefined || affected(view)),
  );
  return { agents: agents.map(item) };
}

export async function showAgent(
  deps: AgentsDeps,
  place: Place,
  id: string,
): Promise<AgentsShowReport | Refusal> {
  const lease = leaseFor(deps, place);
  if ("refused" in lease) return lease;
  const all = await registryViews(deps, place.projectRoot, lease);
  const view = all.find((found) => found.id === id);
  if (view === undefined) return notFound(id);
  return {
    ...item(view),
    linkedAt: view.linkedAt,
    openCallSince: view.openCallSince,
    endedAt: view.endedAt,
    endedBy: view.endedBy,
    continuations: view.continuations,
    children: all
      .filter((child) => child.parent === id)
      .map((child) => ({
        id: child.id,
        type: child.type,
        state: child.state,
        target: child.target,
      })),
  };
}

export function leaseFor(deps: AgentsDeps, place: Place): Lease | Refusal {
  const resolved = resolveOrRefuse({
    store: deps.store,
    settings: deps.settings,
    globalDir: place.globalDir,
    projectRoot: place.projectRoot,
    pluginRoot: deps.pluginRoot,
  });
  return "refused" in resolved ? resolved : leaseOf(resolved.value);
}

/** Every view; a project without a registry has none, and reading never creates one. */
async function registryViews(
  deps: AgentsDeps,
  projectRoot: string,
  lease: Lease,
): Promise<AgentView[]> {
  if (!deps.store.exists(agentsRegistryPath(projectRoot))) return [];
  const now = Date.parse(deps.clock.now());
  return withRegistry(deps.openRegistry, projectRoot, (registry) => views(registry, now, lease));
}

async function affectedMatcher(
  deps: AgentsDeps,
  change: ActiveChange,
  entryId: string,
): Promise<{ readonly test: (view: AgentView) => boolean } | Refusal> {
  const entry = await withIndex(deps.openIndex, deps.store, change.projectRoot, (index) => {
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    return findEntry(index, change.id, entryId);
  });
  if (entry === undefined) {
    return refuse("input/not-found", `no entry ${entryId} in ${change.id}`, [
      "bdk log list",
      `bdk log show ${entryId}`,
    ]);
  }
  const parts = readPlanParts(deps.store, change.dir);
  const holders = taskHolders(parts);
  return {
    test: (view) => {
      if (view.state !== "running" || view.package === null || view.target === null) return false;
      const target = view.target;
      const part = parts.find((found) => found.id === target);
      const names = targetNames(target, {
        part: part === undefined ? holders.get(target)?.id : target,
        tasks: part?.tasks.map((task) => task.id) ?? [],
        files: targetFiles(parts, target) ?? [],
      });
      return namesTarget(entry.refs, names);
    },
  };
}

function item(view: AgentView): AgentItem {
  return {
    id: view.id,
    type: view.type,
    state: view.state,
    parent: view.parent,
    session: view.session,
    package: view.package,
    ticket: view.ticket,
    target: view.target,
    startedAt: view.startedAt,
    lastSeenAt: view.lastSeenAt,
  };
}

export function notFound(id: string): Refusal {
  return refuse("input/not-found", `no agent ${id} in the registry of this project`, [
    "bdk agents list --all",
    "use the id from the BDK-AGENT-ID line of your start context",
  ]);
}
