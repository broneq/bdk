// What `evidence record`, `evidence coverage` and `evidence check` answer (`kernel-cli/evidence`).

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

/** `bdk evidence coverage`: the manifest and the numbers its verdict was computed from. */
export interface CoverageReport {
  readonly evidence: string;
  readonly tool: string;
  readonly min: number | null;
  readonly percent: number | null;
  readonly covered: number;
  readonly total: number;
  readonly unmeasured: readonly string[];
  readonly verdict: "pass" | "fail";
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
