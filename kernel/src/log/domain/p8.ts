// The P8 downgrade (`kernel-cli/log`, `log add`; T23-D34): a blocker written
// under a `verifier` or `design-verifier` ticket must name a blocking
// category, or it is stored as an observation for review. Pure: the caller
// passes the ticket's role and the resolved category ids.

const DOWNGRADING_ROLES: readonly string[] = ["verifier", "design-verifier"];

interface Downgraded {
  readonly type: "blocker";
  readonly category: string | null;
}

export interface Classified {
  readonly type: string;
  readonly body: string;
  readonly review: boolean;
  readonly downgraded?: Downgraded;
}

/** Whether `log add` needs the blocking categories to classify the draft. */
export function mayDowngrade(type: string, role: string | undefined): boolean {
  return type === "blocker" && role !== undefined && DOWNGRADING_ROLES.includes(role);
}

/** The draft as written: unchanged, or an observation whose body names the category. */
export function classify(
  draft: {
    readonly type: string;
    readonly body: string;
    readonly review: boolean;
    readonly category?: string;
  },
  role: string | undefined,
  blocking: readonly string[],
): Classified {
  const kept = { type: draft.type, body: draft.body, review: draft.review };
  if (!mayDowngrade(draft.type, role)) return kept;
  if (draft.category !== undefined && blocking.includes(draft.category)) return kept;
  const category = draft.category ?? null;
  const sentence = `Downgraded from blocker: category ${category ?? "none"} is not a blocking category (P8).\n`;
  const given = draft.body.trim();
  return {
    type: "observation",
    body: given === "" ? sentence : `${sentence}\n${given}\n`,
    review: true,
    downgraded: { type: "blocker", category },
  };
}
