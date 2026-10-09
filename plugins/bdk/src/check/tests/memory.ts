// An in-memory file system and a fake shell for the check slice tests.

import type { Entry, Files } from "../../shared/fs/index.ts";
import { GitError } from "../../shared/git/index.ts";
import type { Shell, ShellOptions, ShellOutcome } from "../../shared/shell/index.ts";

export const ROOT = "/work/app";
export const RUN = ".bdk/runs/v3-1-x";

/** A file system of `path -> text`; directories are implied by the paths. */
export function memory(initial: Record<string, string>): Files & {
  readonly data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    readText: (path) => data.get(path),
    list(dir) {
      const entries = new Map<string, Entry>();
      for (const path of data.keys()) {
        if (!path.startsWith(`${dir}/`)) continue;
        const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
        entries.set(name, { name, dir: rest.length > 0 });
      }
      if (entries.size === 0) return undefined;
      return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText: (path, text) => data.set(path, text),
    appendText: (path, text) => data.set(path, (data.get(path) ?? "") + text),
  };
}

export interface Script {
  readonly output: string;
  readonly outcome: ShellOutcome;
}

/** A shell that writes each command's scripted output; an unscripted command exits 0 silently. */
export function fakeShell(
  files: Files,
  scripts: Readonly<Record<string, Script>> = {},
): Shell & { readonly calls: (ShellOptions & { readonly command: string })[] } {
  const calls: (ShellOptions & { readonly command: string })[] = [];
  const shell = (command: string, options: ShellOptions): Promise<ShellOutcome> => {
    calls.push({ command, ...options });
    const script = scripts[command] ?? { output: "", outcome: { kind: "exit", code: 0 } };
    files.writeText(options.output, script.output);
    return Promise.resolve(script.outcome);
  };
  return Object.assign(shell, { calls });
}

/** A git that answers by its arguments joined with spaces; an unscripted call exits 128. */
export function fakeGit(answers: Readonly<Record<string, string>>): ((
  cwd: string,
  args: readonly string[],
) => string) & {
  readonly calls: { readonly cwd: string; readonly args: readonly string[] }[];
} {
  const calls: { readonly cwd: string; readonly args: readonly string[] }[] = [];
  const git = (cwd: string, args: readonly string[]): string => {
    calls.push({ cwd, args });
    const answer = answers[args.join(" ")];
    if (answer === undefined) throw new GitError(args, 128, "fatal: scripted failure");
    return answer;
  };
  return Object.assign(git, { calls });
}
