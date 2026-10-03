// The review group of a `dispatch build --group` (`kernel-cli/dispatch`;
// T42-A1, K): the flag checks that need no state, and the text of the
// `Review` and `Risks` sections. Pure, so the grammar is tested without a
// Change.

/** The roles a review group dispatches: the reviewers, the gate runner and a scout. */
const GROUPED_ROLES: readonly string[] = ["reviewer", "integration-reviewer", "runner", "scout"];

const REVIEWING_ROLES: readonly string[] = ["reviewer", "integration-reviewer"];
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
