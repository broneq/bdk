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
