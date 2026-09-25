// The shapes the four `config` commands answer with. The zod schemas in
// `schema/` are checked against these types, so the two cannot drift.

export type LayerName = "default" | "global" | "project" | "local";
export type FileLayerName = Exclude<LayerName, "default">;

export interface LayerEntry {
  readonly layer: FileLayerName;
  readonly path: string;
  readonly present: boolean;
}

export interface ShowReport {
  readonly key?: string | undefined;
  readonly value: unknown;
  readonly origins?: Readonly<Record<string, LayerName>> | undefined;
  readonly layers: readonly LayerEntry[];
}

type WarningCode = "missing-modeline" | "schema-outdated" | "legacy-settings";

export interface CheckWarning {
  readonly layer: FileLayerName;
  readonly path: string;
  readonly key?: string | undefined;
  readonly code: WarningCode;
  readonly message: string;
}

export interface CheckReport {
  readonly problems: readonly CheckWarning[];
  readonly snapshot?: string | undefined;
  readonly overriddenKeys: readonly string[];
}

export interface SchemaReport {
  readonly module?: string | undefined;
  readonly schema?: Readonly<Record<string, unknown>> | undefined;
  readonly url: string;
  readonly offlineCopy?: string | undefined;
}

export interface SetReport {
  readonly key: string;
  readonly value: unknown;
  readonly previous?: unknown;
  readonly layer: FileLayerName;
  readonly path: string;
}
