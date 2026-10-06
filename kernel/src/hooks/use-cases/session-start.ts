// `bdk hooks session-start`: the STARTUP text, then, in a BDK project, the
// formatter guard, the configuration check, the v2 layout detection and the
// rules load as findings. The guard is only reported, never written: a session
// start must not dirty the working tree. Nothing here
// refuses: a configuration problem must not stop the model at session start.
import { join } from "node:path";

import { detectLayout, inspectConfig } from "../../config/index.ts";
import { startupContext } from "../../ctx/index.ts";
import { rulesOverLimit } from "../../rules/index.ts";
import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
import { findProjectRoot, FORMATTER_GUARD, formatterGuardState } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { verboseModule } from "../config.ts";
import type { SessionFindings } from "../domain/report.ts";
import type { HooksDeps } from "./input.ts";
import { verboseMarkerPath } from "./journal.ts";

export interface SessionStartInput extends Pick<
  HooksDeps,
  "store" | "git" | "pluginRoot" | "settings"
> {
  readonly cwd: string;
  /** Absent outside a git work tree: the command is standalone. */
  readonly workTree: string | undefined;
  readonly globalDir: string;
}

/** The work tree files, or undefined when git cannot list them: a session start never stops. */
async function listedFiles(
  input: SessionStartInput,
  projectRoot: string,
): Promise<string[] | undefined> {
  try {
    return await workTreeFiles(input.git, projectRoot);
  } catch {
    return undefined;
  }
}

export async function sessionStart(input: SessionStartInput): Promise<SessionFindings> {
  const startup = startupContext(input).content;
  if (input.workTree === undefined) return { startup };
  const projectRoot = findProjectRoot(input.store, input.cwd, input.workTree);
  if (!input.store.isDirectory(join(projectRoot, ".bdk"))) return { startup };

  const { errors, report } = inspectConfig({ ...input, projectRoot });
  const { layout, present } = detectLayout(input.store, projectRoot);
  const warnings = (report?.problems ?? [])
    .filter((warning) => warning.code !== "legacy-settings")
    .map((warning) => `${warning.path}: ${warning.message}`);
  const workTree = errors.length === 0 ? await listedFiles(input, projectRoot) : undefined;
  const rules =
    workTree === undefined
      ? undefined
      : rulesOverLimit(input, projectRoot, input.globalDir, workTree);
  syncVerboseMarker(
    input.store,
    projectRoot,
    errors.length === 0 && verboseSetting(input, projectRoot),
  );
  return {
    startup,
    project: {
      layout,
      v2Markers: present,
      errors: errors.map(({ why, instead }) => ({ why, instead })),
      warnings,
      ...(formatterGuardState(input.store, projectRoot) === "ok"
        ? {}
        : { formatterGuard: FORMATTER_GUARD.trimEnd() }),
      ...(rules === undefined ? {} : { rules }),
    },
  };
}

function verboseSetting(input: SessionStartInput, projectRoot: string): boolean {
  const resolved = resolveOrRefuse({ ...input, projectRoot });
  return !("refused" in resolved) && moduleValue(verboseModule, resolved.value);
}

/** Keeps the marker in step with the setting; a write that fails leaves the session start unchanged. */
function syncVerboseMarker(store: Store, projectRoot: string, on: boolean): void {
  const marker = verboseMarkerPath(projectRoot);
  try {
    if (on) store.write(marker, "");
    else store.remove(marker);
  } catch {
    // Diagnostics never block a session start.
  }
}
