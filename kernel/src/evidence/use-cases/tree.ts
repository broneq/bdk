// The file-class partition and the tree hash of a target (`kernel-state`,
// Evidence manifest, Tree hash; T23-D16, D45). One function serves
// `evidence record`, `evidence check`, `attempt close` and the step nodes.
import { createHash } from "node:crypto";

import { firstMatch } from "../../shared/store/index.ts";

/** The two glob lists of `policy.evidence`, the kernel's copy of the file-class partition. */
export interface FilePolicy {
  readonly nonExecutable: readonly string[];
  readonly buildConfig: readonly string[];
}

export type FileClass = "executable" | "non-executable" | "build-config";

/** Build config wins over non-executable: `requirements.txt` counts. */
export function fileClass(policy: FilePolicy, path: string): FileClass {
  if (firstMatch(policy.buildConfig, path) !== undefined) return "build-config";
  if (firstMatch(policy.nonExecutable, path) !== undefined) return "non-executable";
  return "executable";
}

/**
 * The covered files of a scope, unique and in byte order: its `Files:` paths
 * that are not non-executable, plus the working-tree files that are build
 * config, wherever they are.
 */
export function coveredPaths(
  policy: FilePolicy,
  scopeFiles: readonly string[],
  workTreeFiles: readonly string[],
): string[] {
  const covered = new Set<string>();
  for (const path of scopeFiles)
    if (fileClass(policy, path) !== "non-executable") covered.add(path);
  for (const path of workTreeFiles)
    if (fileClass(policy, path) === "build-config") covered.add(path);
  return [...covered].sort(byteOrder);
}

export interface TreeEntry {
  readonly path: string;
  /** The file's `sha256:` hash, or `absent` when it does not exist. */
  readonly hash: string;
}

export interface Tree {
  readonly treeHash: string;
  readonly tree: readonly TreeEntry[];
}

/**
 * sha256 over the paths in byte order, each contributing its path, a NUL, its
 * file hash or `absent`, and a NUL; so a rename, a deletion and a new file
 * each change it.
 */
export function treeOf(
  paths: readonly string[],
  read: (path: string) => Uint8Array | undefined,
): Tree {
  const tree = [...paths].sort(byteOrder).map((path) => {
    const bytes = read(path);
    return { path, hash: bytes === undefined ? "absent" : sha256(bytes) };
  });
  const hash = createHash("sha256");
  for (const entry of tree) hash.update(`${entry.path}\0${entry.hash}\0`);
  return { treeHash: `sha256:${hash.digest("hex")}`, tree };
}

/** The paths whose hash differs between two trees, added and removed ones included. */
export function changedSince(
  recorded: readonly TreeEntry[],
  current: readonly TreeEntry[],
): string[] {
  const before = new Map(recorded.map((entry) => [entry.path, entry.hash]));
  const after = new Map(current.map((entry) => [entry.path, entry.hash]));
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort(byteOrder);
}

export function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function byteOrder(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}
