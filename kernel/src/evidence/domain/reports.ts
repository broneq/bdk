// What `evidence record` and `evidence check` answer (`kernel-cli/evidence`).

export interface RecordedFile {
  /** Relative to the project root. */
  readonly path: string;
  readonly hash: string;
  readonly stored: "committed" | "machine";
}

export interface RecordReport {
  readonly evidence: string;
  /** The manifest, relative to the project root. */
  readonly path: string;
  readonly treeHash: string;
  readonly files: readonly RecordedFile[];
  readonly verdict?: "pass" | "fail" | "not-run" | undefined;
  readonly citations?: readonly string[] | undefined;
  /** True when an equal manifest existed: it is returned and nothing was written. */
  readonly deduplicated: boolean;
}

interface CheckedManifest {
  readonly evidence: string;
  readonly kind: string;
  readonly treeHash: string;
  readonly fresh: boolean;
  readonly verdict?: "pass" | "fail" | "not-run" | undefined;
  readonly changedSince: readonly string[];
}

export interface CheckReport {
  readonly fresh: boolean;
  readonly treeHash: string;
  readonly evidence: readonly CheckedManifest[];
}
