// The commands of a kernel-run step kind (`kernel-cli/check`, step 2): for
// `tests-scoped` each `tools.test` entry of tier `fast`, its `related`, else
// `scoped`, else `command`; for `lint` each `tools.lint` entry, its `scoped`,
// else `command`; `{files}` filled with the target's executable files. The
// dispatch package shows the same composition to the agent (#166).

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

export interface StepCommand {
  readonly tool: string;
  readonly command: string;
  readonly when?: string | undefined;
}

/** The commands of a step kind in the order of the configured entries; none for another kind. */
export function stepCommands(kind: string, tools: ToolLists, files: string): StepCommand[] {
  const filled = (form: string) => form.replaceAll("{files}", files);
  const entries =
    kind === "tests-scoped"
      ? tools.test
          .filter((entry) => entry.tier === "fast")
          .map((entry) => [entry, entry.related ?? entry.scoped ?? entry.command] as const)
      : kind === "lint"
        ? tools.lint.map((entry) => [entry, entry.scoped ?? entry.command] as const)
        : [];
  return entries.map(([entry, form]) => ({
    tool: entry.id,
    command: filled(form),
    ...(entry.when === undefined ? {} : { when: entry.when }),
  }));
}
