// The `Checks` section of a package. A part's agents run their checks through
// `bdk check run`, which composes, runs and records them and prints the commit
// command (#166): the package names the exact calls and shows what they run.
// A review fix is checked over the Change and committed by `bdk commit
// <change-id>` (T42). A grouped runner of a review round runs the full checks
// of the review stage (T42-D9).

/** A `tools.test` or `tools.lint` entry, as the full checks show it. */
interface ToolEntry {
  readonly id: string;
  readonly command: string;
  readonly when?: string | undefined;
  readonly coverage?: { readonly command: string; readonly report: string } | undefined;
}

interface ToolLists {
  readonly test: readonly ToolEntry[];
  readonly lint: readonly ToolEntry[];
}

function withWhen(command: string, entry: ToolEntry): string {
  return `- \`${command}\`${entry.when === undefined ? "" : `: ${entry.when}`}`;
}

const FULL_INTRO =
  "Run the checks in this order. Save each check's output to a file under `.bdk/.machine/checks/<ticket>/` (git ignores it; a file elsewhere is a change in the tree) and end the file with the line `exit <code>`, so a check that prints nothing still leaves a line to cite; never write or edit the output yourself. Record each file; for `pass`, cite the output line or JSON value that shows the result as `--cite <file>:<line>=<text>` or `--cite <file>#<json-pointer>`.";

function recordLine(kind: string, ticket: string): string {
  return `\`bdk evidence record ${kind} <file> --ticket ${ticket} --verdict pass|fail|not-run --cite <citation>\``;
}

/**
 * The full checks of the review stage (T42-D4, D9): `tests-full` runs every
 * test entry's `command`, then each entry's coverage run with the line that
 * hands its report to the kernel, which decides the verdict; `lint-full` runs
 * every lint entry's `command`. Only the `kinds` the Change's graph applies
 * get a section: a declared-none tool group has none (T49).
 */
export function fullChecksText(kinds: readonly string[], tools: ToolLists, ref: string): string {
  const ticketDir = ref.split("@")[0] ?? ref;
  const intro = FULL_INTRO.replace("<ticket>", ticketDir);
  const coverage = tools.test.flatMap((entry) =>
    entry.coverage === undefined
      ? []
      : [
          `- \`${entry.coverage.command}\`, then \`bdk evidence coverage ${entry.id} ${entry.coverage.report} --ticket ${ref}\`: the kernel reads the report and decides the coverage verdict; never record coverage yourself.`,
        ],
  );
  const all: [string, string[]][] = [
    ["tests-full", [...tools.test.map((entry) => withWhen(entry.command, entry)), ...coverage]],
    ["lint-full", tools.lint.map((entry) => withWhen(entry.command, entry))],
  ];
  const applied = all.filter(([kind]) => kinds.includes(kind));
  if (applied.length === 0) return `${intro}\n\nThis Change runs no full check.`;
  const sections = applied.map(([kind, commands]) =>
    commands.length === 0
      ? `### ${kind}\n\nNo command is configured for \`${kind}\`: record it with \`--verdict not-run\` and that reason in the file.\n\n${recordLine(kind, ref)}`
      : `### ${kind}\n\n${commands.join("\n")}\n\nRecord: ${recordLine(kind, ref)}`,
  );
  return `${intro}\n\n${sections.join("\n\n")}`;
}

/** The commands `bdk check run` runs for one kernel-run step kind, `{files}` unfilled. */
interface KindCommands {
  readonly kind: string;
  readonly commands: readonly {
    readonly tool: string;
    readonly command: string;
    readonly when?: string | undefined;
  }[];
}

export interface PartChecks {
  readonly ticket: string;
  /** The targets the agent checks, in order: the open tasks, the part, or the Change. */
  readonly targets: readonly string[];
  /** The kernel-run step kinds the Change applies, in pipeline order. */
  readonly kinds: readonly KindCommands[];
  /** The Change id of a review round's fix, which `bdk commit` commits; undefined for a part. */
  readonly round?: string | undefined;
}

/**
 * The `Checks` of a part's or a review fix's implementer or conformer (#166):
 * the exact `bdk check run` calls, the commands each kind runs with `{files}`
 * left for the kernel to fill, and how the work is committed: for a part only
 * through the printed `git` command, for a review fix by the orchestrator.
 */
export function partChecksText(input: PartChecks): string {
  const calls = input.targets
    .map((target) => `- \`bdk check run ${target} --ticket ${input.ticket}\``)
    .join("\n");
  const kinds =
    input.kinds.length === 0
      ? "This Change runs no check after a task: `bdk check run` runs the diff check and prints the commit command."
      : input.kinds
          .map(({ kind, commands }) => {
            const lines =
              commands.length === 0
                ? `No command is configured for \`${kind}\`: \`bdk check run\` records it \`not-run\` with that reason.`
                : commands
                    .map(
                      (command) =>
                        `- \`${command.tool}\`: \`${command.command}\`${command.when === undefined ? "" : `, skippable with \`--skip ${command.tool}\` when it does not apply: ${command.when}`}`,
                    )
                    .join("\n");
            return `### ${kind}\n\n${lines}`;
          })
          .join("\n\n");
  return [
    "Never compose, run or record a check yourself: the kernel runs them with `{files}` set to the target's executable `Files:`, saves each output under `.bdk/.machine/checks/" +
      input.ticket +
      "/`, records the evidence and prints the commit command.",
    `Run, each after its work is done:\n\n${calls}`,
    kinds,
    input.round === undefined
      ? "On `verdict: fail` fix what the tail shows and run the same call again. Otherwise run the `git` command it printed, exactly as printed: it commits the target's declared paths with the BDK trailers. Commit with no other git command; a commit that meets git's `index.lock` is run again."
      : `On \`verdict: fail\` fix what the tail shows and run the same call again. Commit nothing yourself: the orchestrator commits the fix with \`bdk commit ${input.round}\` after you return, and the round's review then checks it.`,
  ].join("\n\n");
}
