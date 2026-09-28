// The `Checks` section of a runner package (T23-D44): per post-task step the
// runner runs, the project's commands for it with `{files}` filled, their
// `when` texts and the exact `evidence record` line. The kernel scopes the
// commands, so the package is enough to run them (T23-D0).

interface ToolEntry {
  readonly id: string;
  readonly command: string;
  readonly scoped?: string | undefined;
  readonly related?: string | undefined;
  readonly when?: string | undefined;
  readonly tier?: string | undefined;
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

export function checksText(
  kinds: readonly string[],
  tools: ToolLists,
  files: readonly string[],
  ticket: string,
): string {
  const intro =
    "Run the checks in this order. Save each check's output to a file and record it; for `pass`, cite the output line or JSON value that shows the result.";
  if (kinds.length === 0) return `${intro}\n\nThis Change runs no check after a task.`;
  const sections = kinds.map((kind) => {
    const record = `\`bdk evidence record ${kind} <file> --ticket ${ticket} --verdict pass|fail|not-run --cite <citation>\``;
    if (files.length === 0) {
      return `### ${kind}\n\nThe target has no executable file: record \`${kind}\` with \`--verdict not-run\` and that reason in the file.\n\n${record}`;
    }
    const commands = commandsOf(kind, tools, files.join(" "));
    if (commands.length === 0) {
      return `### ${kind}\n\nNo command is configured for \`${kind}\`: record it with \`--verdict not-run\` and that reason in the file.\n\n${record}`;
    }
    return `### ${kind}\n\n${commands.join("\n")}\n\nRecord: ${record}`;
  });
  return `${intro}\n\n${sections.join("\n\n")}`;
}
