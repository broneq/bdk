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
