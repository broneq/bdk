// The resume table of "Autopilot continuation" (spec `bdk-cli/run`) as pure rules: what a
// Change's files say, in, and the open stage, out. The store gathers the snapshot.

export const STAGES = [
  "propose",
  "design",
  "plan",
  "execute",
  "auto-review",
  "close",
  "done",
] as const;
export type Stage = (typeof STAGES)[number];

export const STEPS = [
  "first-round",
  "repeat-round",
  "triage",
  "fix",
  "spec-conformance",
  "archive",
  "pr",
] as const;
export type Step = (typeof STEPS)[number];

export const PART_STATUSES = ["pending", "done", "blocked"] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

export const MODES = ["interactive", "non-interactive"] as const;
export type Mode = (typeof MODES)[number];

export interface Part {
  readonly id: string;
  readonly status: PartStatus;
  readonly attempts: number;
  readonly reason: string | null;
}

/** The last numbered report of a verify loop, by its file name. */
export interface Report {
  readonly name: string;
  readonly pass: boolean;
}

export interface Round {
  readonly n: number;
  readonly report: boolean;
}

/** What the folded findings log of one review round says (the `findings` slice folds it). */
export interface Fold {
  /** Findings whose latest level is `blocker` and that have no decision. */
  readonly blockers: number;
  /** Findings whose latest decision is `fix`. */
  readonly fixes: number;
}

/** What the files of one Change say, gathered by the store. */
export interface ChangeSnapshot {
  /** The OpenSpec Change directory, undefined when neither it nor an archived copy exists. */
  readonly openspec:
    | {
        readonly archived: boolean;
        readonly proposal: boolean;
        readonly design: boolean;
        readonly planParts: number;
      }
    | undefined;
  readonly designVerify: Report | undefined;
  readonly planVerify: Report | undefined;
  readonly parts: readonly Part[];
  /** Round directories in ascending order. */
  readonly rounds: readonly Round[];
  /** The last round's `findings.jsonl`, folded. */
  readonly lastRound: Fold;
  /** `close/spec-conformance.md`: undefined when missing. */
  readonly specConformance: boolean | undefined;
  readonly pr: boolean;
}

export interface Derived {
  readonly stage: Stage;
  readonly step: Step | null;
  readonly row: number | null;
  readonly round: number | null;
  readonly reason: string;
}

const VERDICT = /^[\s#>*_]*verdict[\s*_]*:[\s*_]*(pass|fail)\b/i;

/** A report passes when its first verdict line reads `Verdict: PASS`, Markdown marks aside. */
export function passes(text: string): boolean {
  for (const line of text.split("\n")) {
    const match = VERDICT.exec(line);
    if (match) return match[1]?.toLowerCase() === "pass";
  }
  return false;
}

/** The parts of a Change: every plan part and every part `state.json` names, in id order. */
export function mergeParts(planIds: readonly string[], states: readonly Part[]): Part[] {
  const byId = new Map(states.map((part) => [part.id, part]));
  const ids = [...new Set([...planIds, ...byId.keys()])].sort();
  return ids.map((id) => byId.get(id) ?? { id, status: "pending", attempts: 0, reason: null });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function stage(
  name: Stage,
  row: number,
  reason: string,
  step: Step | null = null,
  round: number | null = null,
): Derived {
  return { stage: name, step, row, round, reason };
}

/** The resume table: rows checked in order, the first match wins; no match is `done`. */
export function derive(change: ChangeSnapshot): Derived {
  const { openspec } = change;
  if (openspec === undefined) return stage("propose", 1, "no OpenSpec Change directory");
  if (!openspec.proposal) return stage("propose", 1, "no proposal.md");

  if (!openspec.design) return stage("design", 2, "no design.md");
  if (change.designVerify === undefined) return stage("design", 2, "no design/verify-N.md");
  if (!change.designVerify.pass)
    return stage("design", 2, `design/${change.designVerify.name} does not pass`);

  if (openspec.planParts === 0) return stage("plan", 3, "no plan part in plan/parts/");
  if (change.planVerify === undefined) return stage("plan", 3, "no plan/verify-N.md");
  if (!change.planVerify.pass)
    return stage("plan", 3, `plan/${change.planVerify.name} does not pass`);

  const open = change.parts.filter((part) => part.status !== "done");
  if (open.length > 0) {
    const blocked = open.filter((part) => part.status === "blocked").length;
    const tail = blocked > 0 ? `, ${String(blocked)} blocked` : "";
    return stage(
      "execute",
      4,
      `${String(open.length)} of ${plural(change.parts.length, "part")} not done${tail}`,
    );
  }

  const last = change.rounds.at(-1);
  if (last === undefined) return stage("auto-review", 5, "no review round yet", "first-round", 1);
  const crashed = change.rounds.find((round) => !round.report);
  if (crashed !== undefined) {
    const dir = `review/round-${String(crashed.n)}/`;
    return stage("auto-review", 6, `${dir} has no report.md`, "repeat-round", crashed.n);
  }
  const dir = `review/round-${String(last.n)}`;
  if (change.lastRound.blockers > 0) {
    const what = plural(change.lastRound.blockers, "blocker");
    return stage("auto-review", 7, `${dir}: ${what} without a decision`, "triage", last.n);
  }
  if (change.lastRound.fixes > 0) {
    const what = plural(change.lastRound.fixes, "finding");
    return stage("auto-review", 8, `${dir}: ${what} to fix`, "fix", last.n);
  }

  if (change.specConformance === undefined)
    return stage("close", 9, "no close/spec-conformance.md", "spec-conformance");
  if (!change.specConformance)
    return stage("close", 9, "close/spec-conformance.md does not pass", "spec-conformance");
  if (!openspec.archived) return stage("close", 9, "Change not archived", "archive");
  if (!change.pr) return stage("close", 9, "no close/pr.md", "pr");
  return { stage: "done", step: null, row: null, round: null, reason: "archived, PR opened" };
}
