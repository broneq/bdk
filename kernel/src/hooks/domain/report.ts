// What the content hooks answer: the text the host adds to the session and
// the facts it was built from.

export interface SessionStartReport {
  readonly content: string;
  /** Absent outside a BDK project, where no check runs. */
  readonly layout?: "v3" | "v2" | "none" | undefined;
  readonly configProblems?: number | undefined;
}

export interface SkillExistsReport {
  readonly name: string;
  readonly installed: boolean;
  readonly foundIn?: string | undefined;
  readonly content: string;
}

/** What `session-start` found in a BDK project; absent outside one. */
interface ProjectFindings {
  readonly layout: "v3" | "v2" | "none";
  /** The v2 markers found; empty unless the layout is v2. */
  readonly v2Markers: readonly string[];
  readonly errors: readonly { readonly why: string; readonly instead: readonly string[] }[];
  /** `<path>: <message>` of each config check warning shown. */
  readonly warnings: readonly string[];
  /** The role reading the most rules, when it reads more than `rules.warn-above`. */
  readonly rules?: { readonly role: string; readonly rules: number; readonly limit: number };
}

export interface SessionFindings {
  readonly startup: string;
  readonly project?: ProjectFindings;
}

/** What `pre-tool --json` prints on a pass; a deny is a refusal. */
export interface PreToolPass {
  readonly decision: "pass";
  readonly tool: string;
  readonly subagent: boolean;
}

/** A gate as the stage-command context shows it (T1): enough to decide what to type next. */
export interface GateSummary {
  readonly gate: string;
  readonly ready: boolean;
  readonly done: boolean;
  readonly passedBy?: "user" | "policy" | undefined;
  /** The stage command the user types to pass it. */
  readonly command?: string | undefined;
  /** Live `review: true` entries, listed and never dispositioned. */
  readonly pending: readonly {
    readonly id: string;
    readonly type: string;
    readonly summary: string;
  }[];
}

export interface PolicyPass {
  readonly gate: string;
  readonly stage: string;
  readonly entry: string;
}

/** What `prompt-expansion --json` prints on a pass; a block is a refusal. */
export interface PromptExpansionReport {
  readonly decision: "pass";
  /** The bare skill name (`bdk:plan` -> `plan`). */
  readonly command: string;
  readonly stage?: string | undefined;
  readonly gate?: string | undefined;
  readonly entry?: string | undefined;
  readonly wrote: "transition:user" | "transition:policy" | "transition:stage" | "none";
  readonly skipVerify?: boolean | undefined;
  /** The stage command's gate after this call. */
  readonly status?: GateSummary | undefined;
  /** When the gate was passed before this call. */
  readonly passedAt?: string | undefined;
  /** `/bdk:run`: the gates passed by policy. */
  readonly passed?: readonly PolicyPass[] | undefined;
  /** `/bdk:run`: how the run started (T41). */
  readonly run?: { readonly auto: boolean; readonly intent: boolean } | undefined;
  /** `/bdk:run`: the ready manual gates, which the user passes by typing their command. */
  readonly waiting?: readonly GateSummary[] | undefined;
}

/** What `session-end` answers: a checkpoint that ran, or why it was skipped (T24 design D-14). */
export interface SessionEndReport {
  readonly content: string;
  /** The host's `SessionEnd` reason, echoed. */
  readonly reason?: string | undefined;
  readonly checkpoint: {
    readonly done: boolean;
    /** The short commit. */
    readonly commit?: string | undefined;
    readonly skipped?: string | undefined;
  };
}

/** What `post-tool --json` prints: the link or end it recorded, if any. */
export interface PostToolReport {
  readonly tool: string;
  readonly linked: {
    readonly agent: string;
    readonly parent: string;
    readonly ticket: string | null;
  } | null;
  readonly ended: { readonly agent: string; readonly by: "agent-result" | "task-stop" } | null;
}

/** What `subagent-start --json` prints; `context` is null for a non-BDK agent type. */
export interface SubagentStartReport {
  readonly agent: string | null;
  readonly parent: string | null;
  readonly package: string | null;
  readonly context: string | null;
}

/** What `stop --json` and `subagent-stop --json` print: the continuation check's answer (T41-D7). */
export interface StopReport {
  /** `subagent-stop` only: the agent of `agent_id`; null when the payload names none. */
  readonly agent?: string | null;
  readonly decision: "block" | "pass";
  /** Set on a block: the open work and the next command. */
  readonly reason?: string | undefined;
  /** The thread's continuations after this call. */
  readonly continuations: number;
  /** The stall `finding` written when the limit was reached. */
  readonly stalled?: string | undefined;
}
