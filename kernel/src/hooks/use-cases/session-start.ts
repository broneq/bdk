// `bdk hooks session-start`: the STARTUP text, then, in a BDK project, the
// configuration check and the v2 layout detection as findings. Nothing here
// refuses: a configuration problem must not stop the model at session start.
import { join } from "node:path";

import { detectLayout, inspectConfig } from "../../config/index.ts";
import { startupContext } from "../../ctx/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import type { SessionFindings } from "../domain/report.ts";
import type { HooksDeps } from "./input.ts";

export interface SessionStartInput extends HooksDeps {
  readonly cwd: string;
  /** Absent outside a git work tree: the command is standalone. */
  readonly workTree: string | undefined;
  readonly globalDir: string;
}

export function sessionStart(input: SessionStartInput): SessionFindings {
  const startup = startupContext(input).content;
  if (input.workTree === undefined) return { startup };
  const projectRoot = findProjectRoot(input.store, input.cwd, input.workTree);
  if (!input.store.isDirectory(join(projectRoot, ".bdk"))) return { startup };

  const { errors, report } = inspectConfig({ ...input, projectRoot });
  const { layout, present } = detectLayout(input.store, projectRoot);
  const warnings = (report?.problems ?? [])
    .filter((warning) => warning.code !== "legacy-settings")
    .map((warning) => `${warning.path}: ${warning.message}`);
  return {
    startup,
    project: {
      layout,
      v2Markers: present,
      errors: errors.map(({ why, instead }) => ({ why, instead })),
      warnings,
    },
  };
}
