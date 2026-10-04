// The shapes `version` and `doctor` answer with. The zod schemas in `schema/`
// are checked against these types, so the two cannot drift.

export interface VersionReport {
  readonly kernel: string;
  readonly contract: 3;
  readonly node: string;
}

export interface Finding {
  readonly id: string;
  readonly level: "ok" | "warn" | "fail";
  readonly summary: string;
  readonly repair: string;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly version: VersionReport;
  readonly layout?: "v3" | "v2" | "none" | undefined;
  readonly findings: readonly Finding[];
}

export interface RebuildReport {
  readonly changes: number;
  readonly entries: number;
  readonly attempts: number;
  readonly commits: number;
  readonly migrated: readonly string[];
  readonly durationMs: number;
  readonly warnings: readonly string[];
  /** The kernel part worktrees `rebuild` settled (T45). */
  readonly worktrees: readonly {
    readonly part: string;
    readonly path: string;
    readonly action: "kept" | "removed" | "recreated";
  }[];
}
