// The `Checks` section of a runner package (T23-D44): per post-task step the
// runner runs, the project's commands for it with `{files}` filled, their
// `when` texts and the exact `evidence record` line. The kernel scopes the
// commands, so the package is enough to run them (T23-D0). A grouped runner
// of a review round runs the full checks of the review stage instead (T42-D9).

interface ToolEntry {
  readonly id: string;
  readonly command: string;
  readonly scoped?: string | undefined;
  readonly related?: string | undefined;
  readonly when?: string | undefined;
  readonly tier?: string | undefined;
  readonly coverage?: { readonly command: string; readonly report: string } | undefined;
}

export interface ToolLists {
  readonly test: readonly ToolEntry[];
  readonly lint: readonly ToolEntry[];
}

/** The commands of a built-in step kind, in the order of the configured entries. */
function commandsOf(kind: string, tools: ToolLists, files: string): string[] {
  const filled = (form: string) => form.replaceAll("{files}", files);
  if (kind === "tests-scoped") {
    return tools.test
      .filter((entry) => entry.tier === "fast")
      .map((entry) => withWhen(filled(entry.related ?? entry.scoped ?? entry.command), entry));
  }
  if (kind === "lint") {
    return tools.lint.map((entry) => withWhen(filled(entry.scoped ?? entry.command), entry));
  }
  return [];
}

function withWhen(command: string, entry: ToolEntry): string {
  return `- \`${command}\`${entry.when === undefined ? "" : `: ${entry.when}`}`;
}

const INTRO =
  "Run the checks in this order. Save each check's output to a file under `.bdk/.machine/checks/` (git ignores it; a file elsewhere is a change in the tree) and end the file with the line `exit <code>`, so a check that prints nothing still leaves a line to cite; never write or edit the output yourself. Record each file; for `pass`, cite the output line or JSON value that shows the result as `--cite <file>:<line>=<text>` or `--cite <file>#<json-pointer>`.";

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
  if (applied.length === 0) return `${INTRO}\n\nThis Change runs no full check.`;
  const sections = applied.map(([kind, commands]) =>
    commands.length === 0
      ? `### ${kind}\n\nNo command is configured for \`${kind}\`: record it with \`--verdict not-run\` and that reason in the file.\n\n${recordLine(kind, ref)}`
      : `### ${kind}\n\n${commands.join("\n")}\n\nRecord: ${recordLine(kind, ref)}`,
  );
  return `${INTRO}\n\n${sections.join("\n\n")}`;
}

export function checksText(
  kinds: readonly string[],
  tools: ToolLists,
  files: readonly string[],
  ticket: string,
): string {
  if (kinds.length === 0) return `${INTRO}\n\nThis Change runs no check after a task.`;
  const sections = kinds.map((kind) => {
    const record = recordLine(kind, ticket);
    if (files.length === 0) {
      return `### ${kind}\n\nThe target has no executable file: record \`${kind}\` with \`--verdict not-run\` and that reason in the file.\n\n${record}`;
    }
    const commands = commandsOf(kind, tools, files.join(" "));
    if (commands.length === 0) {
      return `### ${kind}\n\nNo command is configured for \`${kind}\`: record it with \`--verdict not-run\` and that reason in the file.\n\n${record}`;
    }
    return `### ${kind}\n\n${commands.join("\n")}\n\nRecord: ${record}`;
  });
  return `${INTRO}\n\n${sections.join("\n\n")}`;
}
