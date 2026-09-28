// The ticket queries of `kernel-state`, Attempt record and Evidence manifest:
// the ticket's active package, the `package` stamp every `dispatch build`
// writes (T23-D42), and the manifests of a ticket and of a part. They read
// the files, never the index, so a fresh clone answers the same way, and they
// live in `shared/store` so `dispatch`, `rules`, `log`, `evidence`, `attempt`
// and `graph` share them without a slice edge.
import { join } from "node:path";

import type { DispatchPackage } from "./state/dispatch.ts";
import { readDocument, writeDocument } from "./state/documents.ts";
import type { EvidenceManifest } from "./state/evidence.ts";
import { TASK_ID } from "./state/plan.ts";
import type { Store } from "./store.ts";
import { readAttempts } from "./work.ts";

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
