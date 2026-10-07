// The review group of a `dispatch build --group` (`kernel-cli/dispatch`;
// T42-A1, K): the flag checks that need no state, and the text of the
// `Review` and `Risks` sections. Pure, so the grammar is tested without a
// Change.

/** The roles a review group dispatches: the reviewers, the judge, the gate runner and a scout. */
const GROUPED_ROLES: readonly string[] = [
  "reviewer",
  "integration-reviewer",
  "judge",
  "runner",
  "scout",
];

const REVIEWING_ROLES: readonly string[] = ["reviewer", "integration-reviewer", "judge"];
/** The roles that work on the whole round, never on a file list (#158). */
const WHOLE_RANGE_ROLES: readonly string[] = ["integration-reviewer", "judge"];
const GROUP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROUP_MAX = 32;
const FOCUS_MAX = 500;

export interface GroupFlags {
  readonly group?: string | undefined;
  readonly files: readonly string[];
  readonly part?: string | undefined;
  readonly range?: string | undefined;
  readonly focus?: string | undefined;
}

/** Why the group flags are invalid for this role, or undefined. */
export function groupFlagProblem(role: string, flags: GroupFlags): string | undefined {
  if (flags.group === undefined && role === "judge") {
    return "judge judges the entries of a review round: build it with --group judge --range <base>..<head>";
  }
  if (flags.group === undefined) {
    const given = [
      flags.files.length > 0 ? "--file" : undefined,
      flags.part === undefined ? undefined : "--part",
      flags.range === undefined ? undefined : "--range",
      flags.focus === undefined ? undefined : "--focus",
    ].filter((flag) => flag !== undefined);
    return given.length === 0 ? undefined : `${given.join(", ")} only with --group`;
  }
  if (flags.group === "merge") {
    return "merge is the orchestrator's group for the merged review; it has no package";
  }
  if (!GROUP.test(flags.group) || flags.group.length > GROUP_MAX) {
    return `--group ${flags.group}: a review group is kebab-case and at most ${String(GROUP_MAX)} characters`;
  }
  if (!GROUPED_ROLES.includes(role)) {
    return `a review group dispatches ${GROUPED_ROLES.join(", ")}, not ${role}`;
  }
  if (WHOLE_RANGE_ROLES.includes(role) && (flags.files.length > 0 || flags.part !== undefined)) {
    return `${role} works on the whole round after the groups; it takes no --file or --part`;
  }
  if (flags.range === undefined && REVIEWING_ROLES.includes(role)) {
    return `${role} needs --range <base>..<head>, e.g. from bdk review plan`;
  }
  if (flags.range !== undefined && !wellFormedRange(flags.range)) {
    return `--range ${flags.range} is not <base>..<head>`;
  }
  if (flags.focus !== undefined && flags.focus.length > FOCUS_MAX) {
    return `--focus is ${String(flags.focus.length)} characters, above ${String(FOCUS_MAX)}`;
  }
  return undefined;
}

function wellFormedRange(range: string): boolean {
  const sides = range.split("..");
  return (
    sides.length === 2 &&
    sides.every(
      (side) => side !== "" && !/\s/.test(side) && !side.startsWith(".") && !side.endsWith("."),
    )
  );
}

export interface ReviewScope {
  readonly files: readonly string[];
  readonly range?: string | undefined;
  /** The `--part` plan part file, from the project root. */
  readonly partFile?: string | undefined;
  /** The intent and plan documents of the Change that exist, from the project root. */
  readonly intent: readonly string[];
  readonly focus?: string | undefined;
}

/** The `Review` section's body: what to review, against what, and the user's focus. */
export function reviewText(scope: ReviewScope): string {
  const code = (text: string) => `\`${text}\``;
  const lines: string[] = [];
  if (scope.range === undefined) {
    lines.push("Range: none given; work on the committed tree of the Change.");
  } else {
    lines.push(`Range: ${code(scope.range)}.`);
  }
  if (scope.files.length > 0) {
    lines.push(`Files:\n\n${scope.files.map((file) => `- ${code(file)}`).join("\n")}`);
    if (scope.range !== undefined) {
      lines.push(
        `Read the diff with ${code(`git diff ${scope.range} -- ${scope.files.join(" ")}`)}.`,
      );
    }
  } else if (scope.range !== undefined) {
    lines.push(
      `Files: every file of the range, listed by ${code(`git diff --name-only ${scope.range}`)}; read the diff with ${code(`git diff ${scope.range}`)}.`,
    );
  }
  if (scope.partFile !== undefined) {
    lines.push(`The contract to review against: the plan part ${code(scope.partFile)}.`);
  }
  if (scope.intent.length > 0) {
    lines.push(`Intent and design:\n\n${scope.intent.map((path) => `- ${code(path)}`).join("\n")}`);
  }
  if (scope.focus !== undefined) lines.push(`The user's focus for this round: ${scope.focus}`);
  return lines.join("\n\n");
}

export interface IntegrationScope {
  readonly range: string;
  /** The binary files of the range, sorted. */
  readonly binary: readonly string[];
  /** The round's `reviewer` groups, with their report paths from the project root. */
  readonly groups: readonly {
    readonly group: string;
    readonly files: readonly string[];
    readonly report: string;
    readonly stored: boolean;
  }[];
  /** The Change's spec delta paths, from the project root. */
  readonly specDeltas: readonly string[];
  readonly intent: readonly string[];
  readonly focus?: string | undefined;
}

const INTENT_TABLE =
  "| Capability | Requirement | Scenario | Code | Test | State |\n| --- | --- | --- | --- | --- | --- |";

/**
 * The integration reviewer's `Review` section (#158): the range by its stat,
 * never its whole diff, the binary files, the group reports to read the seams
 * from, and the spec deltas to trace with the `## Intent` table format.
 */
export function integrationText(scope: IntegrationScope): string {
  const code = (text: string) => `\`${text}\``;
  const list = (paths: readonly string[]) => paths.map((path) => `- ${code(path)}`).join("\n");
  const lines = [
    "The reviewer groups of this round have finished. Review the Change as a whole: its intent against the code and the tests, the seams between the groups, and the risks.",
    `Range: ${code(scope.range)}. See its shape with ${code(`git diff --stat ${scope.range}`)}, and read the diff of one file with ${code(`git diff ${scope.range} -- <file>`)} where a trace needs it.`,
  ];
  if (scope.binary.length > 0) {
    lines.push(`Not reviewed as text (binary): ${scope.binary.map(code).join(", ")}.`);
  }
  lines.push(
    scope.groups.length === 0
      ? "No reviewer group of this round has a package."
      : `The group reports, one per reviewer group; read their \`## Seams\` first:\n\n${scope.groups
          .map((group) =>
            group.stored
              ? `- ${code(group.group)}: ${group.files.map(code).join(", ")}; report ${code(group.report)}`
              : `- ${code(group.group)} (not reviewed: no report stored): ${group.files.map(code).join(", ")}`,
          )
          .join("\n")}`,
  );
  lines.push(
    scope.specDeltas.length === 0
      ? "The Change holds no spec delta, so your report has no `## Intent` section."
      : `The spec deltas, the intent to trace:\n\n${list(scope.specDeltas)}\n\nYour report ends with an \`## Intent\` table before \`## Areas\`: one row per scenario of an ADDED or MODIFIED requirement and one per REMOVED requirement with \`-\` as its scenario, names as the spec delta writes them, and \`State\` as \`ok\` or the ids of the entries you logged.\n\n${INTENT_TABLE}`,
  );
  if (scope.intent.length > 0) lines.push(`Intent and design:\n\n${list(scope.intent)}`);
  if (scope.focus !== undefined) lines.push(`The user's focus for this round: ${scope.focus}`);
  return lines.join("\n\n");
}

/** An entry the judge triages, as its package lists it: no body (#158). */
export interface JudgedEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  /** The entry's `source`. */
  readonly writer: string;
  readonly group?: string | undefined;
}

export interface JudgeScope {
  readonly range: string;
  readonly entries: readonly JudgedEntry[];
  /** The stored reports of the round, from the project root. */
  readonly reports: readonly string[];
  readonly specDeltas: readonly string[];
  readonly intent: readonly string[];
  readonly focus?: string | undefined;
}

/**
 * The judge's `Review` section (#158): the entries to triage with their refs
 * and writers, never their bodies, and the documents to judge them against.
 */
export function judgeText(scope: JudgeScope): string {
  const code = (text: string) => `\`${text}\``;
  const list = (paths: readonly string[]) => paths.map((path) => `- ${code(path)}`).join("\n");
  const entry = (item: JudgedEntry) =>
    `- ${code(item.id)} ${item.type}: ${item.summary}. Refs: ${item.refs.map(code).join(", ")}. Written by ${item.writer}${
      item.group === undefined ? "" : ` in group ${code(item.group)}`
    }.`;
  const lines = [
    `The reviewers and the integration reviewer of this round have finished. Judge each entry below once, in this order: read its body with ${code("bdk log show <id>")} and the code at its refs only.`,
    `Range: ${code(scope.range)}.`,
    scope.entries.length === 0
      ? "No entry is left to judge."
      : `The entries to judge:\n\n${scope.entries.map(entry).join("\n")}`,
    scope.reports.length === 0
      ? "No report of this round is stored."
      : `The reports of this round:\n\n${list(scope.reports)}`,
  ];
  if (scope.specDeltas.length > 0) lines.push(`The spec deltas:\n\n${list(scope.specDeltas)}`);
  if (scope.intent.length > 0) lines.push(`Intent and design:\n\n${list(scope.intent)}`);
  if (scope.focus !== undefined) lines.push(`The user's focus for this round: ${scope.focus}`);
  return lines.join("\n\n");
}

export interface Risk {
  readonly id: string;
  readonly instruction: string;
  readonly enabled: boolean;
}

/** The enabled risks, one line each. */
export function risksText(risks: readonly Risk[]): string {
  const enabled = risks.filter((risk) => risk.enabled);
  return enabled.length === 0
    ? "The project lists no risky area."
    : enabled.map((risk) => `- \`${risk.id}\`: ${risk.instruction}`).join("\n");
}
