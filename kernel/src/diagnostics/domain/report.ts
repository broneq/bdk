// What the diagnostics commands answer (`kernel-cli/diagnostics`).

export const TRANSCRIPT_STATES = ["ok", "missing", "unreadable", "unavailable"] as const;
export type TranscriptState = (typeof TRANSCRIPT_STATES)[number];

export const DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"] as const;
type Detector = (typeof DETECTORS)[number];

/** Tokens of one model; usage repeated under one `requestId` counts once. */
export interface ModelTokens {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

/** Tokens per model id; null when a transcript it needs is not `ok`. */
export type Tokens = Readonly<Record<string, ModelTokens>> | null;

export interface AgentMetrics {
  readonly agent: string;
  readonly type: string;
  readonly role: string | null;
  readonly wallMs: number | null;
  readonly tokens: Tokens;
}

export interface TaskMetrics {
  readonly task: string;
  readonly part: string;
  readonly tickets: number;
  readonly wallMs: number;
  readonly tokens: Tokens;
}

export interface PartMetrics {
  readonly part: string;
  readonly wallMs: number;
  readonly tokens: Tokens;
}

export interface Finding {
  readonly detector: Detector;
  readonly agent: string;
  readonly ticket: string | null;
  readonly at: string;
  /** `journal:<line>`, `<agent-id>:<line>` or a ledger entry id; `diagnostics slice` resolves it. */
  readonly cite: string;
  readonly summary: string;
}

export interface Cost {
  readonly totalUSD: number;
  readonly byModel: Readonly<Record<string, number>>;
}

export interface DiagnosticsReport {
  readonly session: string;
  readonly change: string | null;
  readonly stage: string | null;
  readonly from: string;
  readonly to: string;
  readonly transcript: TranscriptState;
  /** Transcript lines of a shape the reader does not know. */
  readonly unknownLines: number;
  readonly truncated: boolean;
  readonly refusals: {
    readonly total: number;
    readonly byRule: Readonly<Record<string, number>>;
    readonly byRole: Readonly<Record<string, number>>;
  };
  readonly guardBlocks: number;
  readonly retries: number;
  readonly escalations: number;
  readonly parks: number;
  readonly questions: number;
  readonly agents: readonly AgentMetrics[];
  readonly tasks: readonly TaskMetrics[];
  readonly parts: readonly PartMetrics[];
  readonly tokensUnknownAgents: number;
  readonly cost: Cost | null;
  readonly findings: readonly Finding[];
  readonly anomalies: number;
}

export interface LogReport {
  readonly path: string;
  readonly lines: number;
  readonly transcript: TranscriptState;
}

export interface SliceReport {
  readonly agent: string;
  readonly at: string;
  readonly events: readonly string[];
  readonly omitted: number;
}

export interface WriteReport {
  readonly path: string;
}
