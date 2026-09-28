// The result of `bdk export agents` (`schema/cli/output/export-agents.json`).

export interface AgentFile {
  readonly adapter: string;
  /** Relative to the project root. */
  readonly path: string;
  readonly changed: boolean;
}

export interface AgentsReport {
  readonly host: string;
  readonly files: readonly AgentFile[];
  readonly changed: boolean;
}
