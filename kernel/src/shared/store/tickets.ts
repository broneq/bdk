// The ticket queries of `kernel-state`, Attempt record and Evidence manifest:
// the ticket's active package, the `package` stamp every `dispatch build`
// writes (T23-D42), and the manifests of a ticket and of a part. They read
// the files, never the index, so a fresh clone answers the same way, and they
// live in `shared/store` so `dispatch`, `rules`, `log`, `evidence`, `attempt`
// and `graph` share them without a slice edge. A ticket reference also reads
// the agent registry: the package of the agent working on the ticket wins
// over the active stamp, which the next step's build moves (#133).
import { join, posix } from "node:path";

import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";

import { agentsRegistryPath, withRegistry } from "./agents/registry.ts";
import type { AgentRegistry, AgentRow, RegistryOpener } from "./agents/registry.ts";
import type { DispatchPackage } from "./state/dispatch.ts";
import { readDocument, writeDocument } from "./state/documents.ts";
import type { EvidenceManifest } from "./state/evidence.ts";
import { TASK_ID } from "./state/plan.ts";
import type { Store } from "./store.ts";
import { readAttempts } from "./work.ts";
import type { AttemptFile } from "./work.ts";

const GROUP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROUP_MAX = 32;

/** The group the orchestrator stores the round's merged review under; it has no package (T42-B1). */
export const MERGE_GROUP = "merge";

/** The file name of a round's merged review under `reports/` (`kernel-cli/log`, bdk log ingest). */
export function mergeReportName(target: string, ticket: string): string {
  return `${target}-orchestrator-${ticket}-${MERGE_GROUP}.md`;
}

/** A ticket reference resolved against the Change's attempt records and packages. */
export interface ResolvedRef {
  readonly ticket: string;
  readonly group?: string;
  readonly record?: AttemptFile;
  /** True when the record exists and is not closed. */
  readonly open: boolean;
  /**
   * The group's package for a group reference; else the package of the
   * ticket's working agent, or the ticket's active package without one.
   */
  readonly package?: ActivePackage;
}

/** What a ticket reference reads: the files, and the agent registry. */
export interface TicketDeps {
  readonly store: Store;
  readonly openRegistry: RegistryOpener;
}

/**
 * `<ticket>` or `<ticket>@<group>` (`kernel-cli`, Ticket references): a group
 * that is not kebab-case or is longer than 32 characters, or a group on a
 * ticket of another loop than `review-fix`, is `input/invalid-argument`. A
 * missing record or package is left to the caller, whose rule differs.
 */
export async function resolveTicketRef(
  deps: TicketDeps,
  projectRoot: string,
  changeDir: string,
  value: string,
): Promise<ResolvedRef | Refusal> {
  const { store } = deps;
  const at = value.indexOf("@");
  const ticket = at === -1 ? value : value.slice(0, at);
  const group = at === -1 ? undefined : value.slice(at + 1);
  if (group !== undefined && (!GROUP.test(group) || group.length > GROUP_MAX)) {
    return refuse(
      "input/invalid-argument",
      `${value}: a review group is kebab-case and at most ${String(GROUP_MAX)} characters`,
      [`${ticket}@<group>, e.g. ${ticket}@p01`],
    );
  }
  const record = readAttempts(store, changeDir).find((file) => file.data.ticket === ticket);
  if (group !== undefined && record !== undefined && record.data.loop !== "review-fix") {
    return refuse(
      "input/invalid-argument",
      `${ticket} is a ${record.data.loop} ticket; only a review-fix ticket has review groups`,
      [`--ticket ${ticket}`],
    );
  }
  const open = record !== undefined && record.data["closed-at"] === undefined;
  const found =
    group === undefined
      ? ((await workingPackage(deps, projectRoot, ticket)) ??
        activePackage(store, projectRoot, changeDir, ticket))
      : groupPackage(store, projectRoot, changeDir, ticket, group);
  return {
    ticket,
    ...(group === undefined ? {} : { group }),
    ...(record === undefined ? {} : { record }),
    open,
    ...(found === undefined ? {} : { package: found }),
  };
}

/** The package `dispatch build --group` wrote for the ticket's group; undefined without one. */
function groupPackage(
  store: Store,
  projectRoot: string,
  changeDir: string,
  ticket: string,
  group: string,
): ActivePackage | undefined {
  const dir = join(changeDir, "dispatch");
  const name = store.list(dir).find((file) => file.endsWith(`-${ticket}-${group}.md`));
  if (name === undefined) return undefined;
  const document = readDocument(store, join(dir, name));
  if (document?.kind !== "dispatch" || !("data" in document)) return undefined;
  const data = document.data as unknown as DispatchPackage;
  if (data.group !== group) return undefined;
  const path = posix.relative(projectRoot, join(dir, name));
  return { role: data.role, path, data };
}

/**
 * The ungrouped package of the agent working on the ticket, among the
 * ticket's agents that have not ended: the agents in an open tool call when
 * there are any, as the agent calling the kernel is in one, else the agents
 * whose own report is not stored yet. Undefined without a registry, without
 * such an agent, or when they hold several packages; the active stamp
 * answers then.
 */
async function workingPackage(
  deps: TicketDeps,
  projectRoot: string,
  ticket: string,
): Promise<ActivePackage | undefined> {
  if (!deps.store.exists(agentsRegistryPath(projectRoot))) return undefined;
  const holders = await withRegistry(deps.openRegistry, projectRoot, (registry) =>
    registry
      .all()
      .filter((row) => row.ticket === ticket && notEnded(registry, row))
      .map((row) => ({ row, open: registry.heartbeat(row.id)?.open === true })),
  );
  const held = holders.flatMap(({ row, open }) => {
    const found =
      row.package === null ? undefined : readPackage(deps.store, projectRoot, row.package);
    return found?.data.ticket === ticket && found.data.group === undefined
      ? [{ found, row, open }]
      : [];
  });
  const calling = held.filter(({ open }) => open);
  if (calling.length > 0) return onlyOne(calling);
  return onlyOne(held.filter(({ row }) => agentReport(deps.store, projectRoot, row) === undefined));
}

function onlyOne(held: readonly { readonly found: ActivePackage }[]): ActivePackage | undefined {
  const [first] = held;
  return first !== undefined && held.every(({ found }) => found.path === first.found.path)
    ? first.found
    : undefined;
}

/** The `ended` rule of the registry's derived state: a heartbeat after the end resumes the agent. */
function notEnded(registry: AgentRegistry, row: AgentRow): boolean {
  if (row.endedAt === null) return true;
  const heartbeat = registry.heartbeat(row.id);
  return heartbeat !== undefined && heartbeat.atMs > Date.parse(row.endedAt);
}

/** What `agentReport` reads of an agent: its package and when it was linked and started. */
export interface ReportingAgent {
  readonly package: string | null;
  readonly linkedAt: string | null;
  readonly startedAt: string | null;
}

/**
 * The envelope's `status` of the agent's own report at its package's
 * `report` path, or undefined before `log ingest` stores one. A report whose
 * `at` is earlier than the agent's link and start belongs to an earlier agent
 * of the same package; one without `at` counts as the agent's.
 */
export function agentReport(
  store: Store,
  projectRoot: string,
  agent: ReportingAgent,
): string | undefined {
  if (agent.package === null) return undefined;
  const reportPath = field(store, join(projectRoot, agent.package), "report");
  if (reportPath === undefined) return undefined;
  const path = join(projectRoot, reportPath);
  if (!store.exists(path)) return undefined;
  const at = field(store, path, "at");
  const since = [agent.linkedAt, agent.startedAt]
    .filter((time): time is string => time !== null)
    .map((time) => Date.parse(time));
  if (at !== undefined && since.length > 0 && Date.parse(at) < Math.min(...since)) {
    return undefined;
  }
  return field(store, path, "status") ?? "unknown";
}

/** A string field of a state document's frontmatter; undefined when absent or unreadable. */
function field(store: Store, path: string, name: string): string | undefined {
  try {
    const document = readDocument(store, path);
    if (document === undefined || !("data" in document)) return undefined;
    const value = (document.data as Readonly<Record<string, unknown>>)[name];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface ActivePackage {
  readonly role: string;
  /** Relative to the project root, as the attempt record names it. */
  readonly path: string;
  readonly data: DispatchPackage;
}

/**
 * Writes `packagePath` (relative to the project root) as the ticket's active
 * package. False when the Change holds no record of the ticket.
 */
export function stampPackage(
  store: Store,
  changeDir: string,
  ticket: string,
  packagePath: string,
): boolean {
  const record = readAttempts(store, changeDir).find((file) => file.data.ticket === ticket);
  if (record === undefined) return false;
  writeDocument(store, record.path, {
    data: { ...record.data, package: packagePath },
    body: record.body,
  });
  return true;
}

/** The package the ticket's record names; undefined without a record, a stamp or the file. */
export function activePackage(
  store: Store,
  projectRoot: string,
  changeDir: string,
  ticket: string,
): ActivePackage | undefined {
  const record = readAttempts(store, changeDir).find((file) => file.data.ticket === ticket);
  const path = record?.data.package;
  return path === undefined ? undefined : readPackage(store, projectRoot, path);
}

/** The dispatch package at `path`, relative to the project root; undefined without one. */
function readPackage(store: Store, projectRoot: string, path: string): ActivePackage | undefined {
  const document = readDocument(store, join(projectRoot, path));
  if (document?.kind !== "dispatch" || !("data" in document)) return undefined;
  const data = document.data as unknown as DispatchPackage;
  return { role: data.role, path, data };
}

/** The active package of a ticket whose record is open; undefined otherwise. */
export function openPackage(
  store: Store,
  projectRoot: string,
  changeDir: string,
  ticket: string,
): ActivePackage | undefined {
  const record = readAttempts(store, changeDir).find((file) => file.data.ticket === ticket);
  if (record === undefined || record.data["closed-at"] !== undefined) return undefined;
  return activePackage(store, projectRoot, changeDir, ticket);
}

/** The roles of the ticket's packages under `dispatch/`, in file order. */
export function packageRoles(store: Store, changeDir: string, ticket: string): string[] {
  const dir = join(changeDir, "dispatch");
  const roles: string[] = [];
  for (const name of store.list(dir)) {
    if (!name.endsWith(`-${ticket}.md`)) continue;
    const document = readDocument(store, join(dir, name));
    if (document?.kind !== "dispatch" || !("data" in document)) continue;
    const data = document.data as unknown as DispatchPackage;
    if (data.group === undefined) roles.push(data.role);
  }
  return roles;
}

/** A `reviewer` group package of a round and whether its report is stored. */
export interface ReviewerGroup {
  readonly group: string;
  readonly files: readonly string[];
  /** The report path, relative to the project root. */
  readonly report: string;
  readonly stored: boolean;
}

/**
 * The `reviewer` group packages of a `review-fix` ticket, by group: what the
 * integration reviewer reads after the groups (`kernel-cli/dispatch`, #158).
 * The gate runner, scouts, `integration` and `judge` are left out.
 */
export function reviewerGroups(
  store: Store,
  projectRoot: string,
  changeDir: string,
  ticket: string,
): ReviewerGroup[] {
  const dir = join(changeDir, "dispatch");
  const groups: ReviewerGroup[] = [];
  for (const name of store.list(dir)) {
    if (!name.includes(`-${ticket}-`) || !name.endsWith(".md")) continue;
    const document = readDocument(store, join(dir, name));
    if (document?.kind !== "dispatch" || !("data" in document)) continue;
    const data = document.data as unknown as DispatchPackage;
    if (data.role !== "reviewer" || data.group === undefined || data.ticket !== ticket) continue;
    groups.push({
      group: data.group,
      files: data.files ?? [],
      report: data.report,
      stored: store.exists(join(projectRoot, data.report)),
    });
  }
  return groups.sort((a, b) => compare(a.group, b.group));
}

export interface ManifestFile {
  readonly path: string;
  readonly data: EvidenceManifest;
}

/** The evidence manifests of a Change, oldest first by `at`, then id; captures are skipped. */
export function readManifests(store: Store, changeDir: string): ManifestFile[] {
  const dir = join(changeDir, "evidence");
  const manifests: ManifestFile[] = [];
  for (const name of store.list(dir)) {
    if (!name.endsWith(".md")) continue;
    const path = join(dir, name);
    const document = readDocument(store, path);
    if (document?.kind !== "evidence" || !("data" in document)) continue;
    manifests.push({ path, data: document.data as unknown as EvidenceManifest });
  }
  return manifests.sort((a, b) => compare(a.data.at, b.data.at) || compare(a.data.id, b.data.id));
}

export function ticketManifests(
  manifests: readonly ManifestFile[],
  ticket: string,
): ManifestFile[] {
  return manifests.filter((manifest) => manifest.data.ticket === ticket);
}

/** The manifests whose target is the part or one of its tasks; a Change target is not one. */
export function partManifests(manifests: readonly ManifestFile[], part: string): ManifestFile[] {
  return manifests.filter(
    ({ data: { target } }) =>
      target === part || (TASK_ID.test(target) && target.startsWith(`${part}-`)),
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
