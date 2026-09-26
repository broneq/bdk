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
