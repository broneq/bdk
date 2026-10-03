// The ticket queries of `kernel-state`, Attempt record and Evidence manifest:
// the ticket's active package, the `package` stamp every `dispatch build`
// writes (T23-D42), and the manifests of a ticket and of a part. They read
// the files, never the index, so a fresh clone answers the same way, and they
// live in `shared/store` so `dispatch`, `rules`, `log`, `evidence`, `attempt`
// and `graph` share them without a slice edge.
import { join, posix } from "node:path";

import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";

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

/** A ticket reference resolved against the Change's attempt records and packages. */
export interface ResolvedRef {
  readonly ticket: string;
  readonly group?: string;
  readonly record?: AttemptFile;
  /** True when the record exists and is not closed. */
  readonly open: boolean;
  /** The group's package for a group reference, else the ticket's active package. */
  readonly package?: ActivePackage;
}

/**
 * `<ticket>` or `<ticket>@<group>` (`kernel-cli`, Ticket references): a group
 * that is not kebab-case or is longer than 32 characters, or a group on a
 * ticket of another loop than `review-fix`, is `input/invalid-argument`. A
 * missing record or package is left to the caller, whose rule differs.
 */
export function resolveTicketRef(
  store: Store,
  projectRoot: string,
  changeDir: string,
  value: string,
): ResolvedRef | Refusal {
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
      ? activePackage(store, projectRoot, changeDir, ticket)
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
  if (path === undefined) return undefined;
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
    roles.push((document.data as unknown as DispatchPackage).role);
  }
  return roles;
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
