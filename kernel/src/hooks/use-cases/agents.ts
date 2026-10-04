// Where the agent hooks and guards meet the registry (T41-D4 to D7): the
// project the payload belongs to, the resolved `agents.*` settings, and the
// facts the agent guards decide on, gathered only for the payloads that need
// them so an ordinary tool call never opens the registry.
import { join } from "node:path";

import { findView, leaseOf } from "../../agents/index.ts";
import type { AgentView } from "../../agents/index.ts";
import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { KernelRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  agentsRegistryPath,
  findProjectRoot,
  readAttempts,
  readDocument,
  resolveActiveChange,
  withRegistry,
} from "../../shared/store/index.ts";
import type { AgentRegistry } from "../../shared/store/index.ts";
import { messageModule, scoutModule } from "../config.ts";
import type { AgentFacts } from "../domain/guards.ts";
import type { HooksDeps } from "./input.ts";

export interface HookPlace {
  readonly cwd: string;
  /** The git work tree, when the hook runs inside one. */
  readonly workTree?: string;
  readonly globalDir: string;
}

/** The project root holding `.bdk/`, or undefined outside a BDK project. */
export function bdkProject(deps: HooksDeps, place: HookPlace): string | undefined {
  if (place.workTree === undefined) return undefined;
  const root = findProjectRoot(deps.store, place.cwd, place.workTree);
  return deps.store.isDirectory(join(root, ".bdk")) ? root : undefined;
}

/** The resolved settings; undefined when they do not resolve (a hook never refuses for that). */
export function settingsOf(
  deps: HooksDeps,
  projectRoot: string,
  place: HookPlace,
): Readonly<Mapping> | undefined {
  try {
    const resolved = resolveOrRefuse({
      store: deps.store,
      settings: deps.settings,
      globalDir: place.globalDir,
      projectRoot,
      pluginRoot: deps.pluginRoot,
    });
    return "refused" in resolved ? undefined : resolved.value;
  } catch (error) {
    // A settings file that does not parse throws its refusal.
    if (error instanceof KernelRefusal) return undefined;
    throw error;
  }
}

export function activeChangeOf(deps: HooksDeps, place: HookPlace): ActiveChange | undefined {
  if (place.workTree === undefined) return undefined;
  const change = resolveActiveChange(deps.store, deps.git, {
    cwd: place.cwd,
    workTree: place.workTree,
  });
  return "refused" in change ? undefined : change;
}

/** Runs `work` on the registry of a BDK project; creates the registry on first use. */
export function onRegistry<T>(
  deps: HooksDeps,
  projectRoot: string,
  work: (registry: AgentRegistry) => T,
): Promise<T> {
  return withRegistry(deps.openRegistry, projectRoot, work);
}

export function registryExists(deps: HooksDeps, projectRoot: string): boolean {
  return deps.store.exists(agentsRegistryPath(projectRoot));
}

/** The facts of `AgentFacts` for one payload of agent `callerId`. */
export async function agentFacts(
  deps: HooksDeps,
  place: HookPlace,
  callerId: string,
): Promise<AgentFacts> {
  const projectRoot = bdkProject(deps, place);
  // Settings that do not resolve give the modules' defaults: a guard never fails on them.
  const settings =
    (projectRoot === undefined ? undefined : settingsOf(deps, projectRoot, place)) ?? {};
  const change = activeChangeOf(deps, place);
  const facts = {
    messageLimit: moduleValue(messageModule, settings)["max-chars"],
    scoutLimit: moduleValue(scoutModule, settings)["max-per-ticket"],
    ticketTarget: (ticket: string) =>
      change === undefined
        ? undefined
        : readAttempts(deps.store, change.dir).find((record) => record.data.ticket === ticket)?.data
            .target,
    entryExists: (id: string) =>
      change !== undefined &&
      deps.store.list(join(change.dir, "log")).some((name) => name.endsWith(`-${id}.md`)),
  };
  if (projectRoot === undefined || !registryExists(deps, projectRoot)) {
    return { ...facts, scouts: 0, stateOf: () => undefined };
  }
  const lease = leaseOf(settings);
  const now = Date.parse(deps.clock.now());
  return onRegistry(deps, projectRoot, (registry) => {
    const caller = registry.get(callerId);
    const rows = registry.all();
    const holders = new Set(
      rows
        .filter((row) =>
          caller?.ticket === null || caller === undefined
            ? row.id === callerId
            : row.ticket === caller.ticket,
        )
        .map((row) => row.id),
    );
    const states = new Map<string, AgentView["state"]>(
      rows.map((row) => [row.id, findView(registry, row.id, now, lease)?.state ?? "ended"]),
    );
    const workdir =
      caller?.package == null ? undefined : packageWorkdir(deps, join(projectRoot, caller.package));
    return {
      ...facts,
      ...(caller === undefined ? {} : { caller: { ticket: caller.ticket, target: caller.target } }),
      ...(workdir === undefined ? {} : { workdir }),
      scouts: rows.filter((row) => row.type === "bdk:scout" && holders.has(row.parent ?? ""))
        .length,
      stateOf: (id: string) => states.get(id),
    };
  });
}

/** The `workdir` of a dispatch package; undefined when it has none or does not parse. */
function packageWorkdir(deps: HooksDeps, path: string): string | undefined {
  const document = deps.store.read(path) === undefined ? undefined : readDocument(deps.store, path);
  if (document === undefined || !("data" in document) || document.kind !== "dispatch") {
    return undefined;
  }
  const workdir = (document.data as { workdir?: unknown }).workdir;
  return typeof workdir === "string" ? workdir : undefined;
}
