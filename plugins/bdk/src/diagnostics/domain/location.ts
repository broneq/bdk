// Where the host keeps a project's transcripts, and which sessions belong to a Change (design D5).

import { join } from "node:path";

/** Claude Code's directory name for a project: the absolute root, every non-alphanumeric as `-`. */
export function projectKey(root: string): string {
  return root.replace(/[^A-Za-z0-9]/g, "-");
}

export function transcriptsDir(input: {
  readonly cwd: string;
  readonly home: string;
  readonly configDir: string | undefined;
}): string {
  const config =
    input.configDir === undefined || input.configDir === ""
      ? join(input.home, ".claude")
      : input.configDir;
  return join(config, "projects", projectKey(input.cwd));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether a main transcript names the Change by one of the paths every BDK stage uses: its run
 * directory or its OpenSpec Change directory, active or archived.
 */
export function namesChange(text: string, change: string): boolean {
  const name = escape(change);
  return new RegExp(
    `\\.bdk/runs/${name}(?![A-Za-z0-9-])|openspec/changes/(?:archive/\\d{4}-\\d{2}-\\d{2}-)?${name}(?![A-Za-z0-9-])`,
  ).test(text);
}
