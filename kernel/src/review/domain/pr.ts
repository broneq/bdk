// The view model of the pull request decision page (`kernel-cli/review`, bdk
// review render --pr; T42-J): the parsed `pr-review-result` blocks with an id
// and a preselected choice per finding, and the verdict those choices give.

export const PR_CHOICES = ["blocker", "nice-to-have", "tracker", "drop"] as const;

interface PrFindingInput {
  readonly path: string;
  readonly line: number;
  readonly severity: string;
  readonly category: string;
  readonly blocking: boolean;
  readonly problem: string;
  readonly why?: string | undefined;
  readonly fix: string;
}

export interface PrInput {
  readonly prs: readonly {
    readonly number: number;
    readonly url: string;
    readonly title: string;
    readonly verdict?: string | undefined;
    readonly findings: readonly PrFindingInput[];
  }[];
}

interface PrFinding extends PrFindingInput {
  /** `<number>-<n>`, `n` counting from 1 in the given order. */
  readonly id: string;
  readonly choice: "blocker" | "nice-to-have";
}

export interface PrPage {
  readonly prs: readonly {
    readonly number: number;
    readonly url: string;
    readonly title: string;
    readonly verdict: "approve" | "request-changes";
    readonly findings: readonly PrFinding[];
  }[];
  readonly tracker: boolean;
}

export function prPage(input: PrInput, tracker: boolean): PrPage {
  return {
    prs: input.prs.map((pr) => {
      const findings = pr.findings.map((finding, at) => ({
        ...finding,
        id: `${String(pr.number)}-${String(at + 1)}`,
        choice: finding.blocking ? ("blocker" as const) : ("nice-to-have" as const),
      }));
      return {
        number: pr.number,
        url: pr.url,
        title: pr.title,
        verdict: findings.some((finding) => finding.choice === "blocker")
          ? "request-changes"
          : "approve",
        findings,
      };
    }),
    tracker,
  };
}
