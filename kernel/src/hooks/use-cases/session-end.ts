// `bdk hooks session-end` (`kernel-cli/hooks`; T24 design D-14): the
// checkpoint core `change checkpoint` uses, run for the Change bound to the
// branch. The host ignores this event's output and exit code, so every
// outcome other than a commit is reported as a skip, never refused. The
// session's run marker goes first, with or without a Change (T41 design D2);
// with the verbose marker, the session's render comes last (T47 design D4).
import { implicitCheckpoint, resolvedSettings } from "../../change/index.ts";
import { writeSessionLog } from "../../diagnostics/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import { removeRunMarker, resolveActiveChange } from "../../shared/store/index.ts";
import { sessionEndPayload } from "../domain/payload.ts";
import type { SessionEndReport } from "../domain/report.ts";
import { bdkProject } from "./agents.ts";
import type { HooksDeps } from "./input.ts";
import { verboseOn } from "./journal.ts";

export interface SessionEndInput {
  readonly cwd: string;
  readonly workTree: string;
  readonly globalDir: string;
}

export async function sessionEnd(
  deps: HooksDeps,
  input: SessionEndInput,
  raw: string,
): Promise<SessionEndReport> {
  const { reason, session } = sessionEndPayload(raw);
  const project = bdkProject(deps, input);
  if (project !== undefined && session !== undefined) removeRunMarker(deps.store, project, session);
  const report = await checkpointReport(deps, input, reason);
  if (project === undefined || session === undefined || !verboseOn(deps, project)) return report;
  const verbose = await verboseRender(
    deps,
    { projectRoot: project, globalDir: input.globalDir },
    session,
  );
  return { ...report, content: [report.content, verbose].filter((line) => line !== "").join("\n") };
}

async function checkpointReport(
  deps: HooksDeps,
  input: SessionEndInput,
  reason: string | undefined,
): Promise<SessionEndReport> {
  const echo = reason === undefined ? {} : { reason };
  const skipped = (why: string): SessionEndReport => ({
    content: "",
    ...echo,
    checkpoint: { done: false, skipped: why },
  });

  const change = resolveActiveChange(deps.store, deps.git, input);
  if (isRefusal(change)) return skipped("no active Change");
  const settings = resolvedSettings(deps, change, input.globalDir);
  if (isRefusal(settings)) return skipped(settings.why);
  const checkpoint = await implicitCheckpoint(deps, change, settings);
  if (!checkpoint.done) return skipped(checkpoint.skipped ?? "the checkpoint did not run");
  return {
    content: `[BDK] checkpoint ${checkpoint.commit ?? ""} of ${change.id}`,
    ...echo,
    checkpoint,
  };
}

/** The line naming the session's render, or why it was not written; never a throw. */
async function verboseRender(
  deps: HooksDeps,
  place: { readonly projectRoot: string; readonly globalDir: string },
  session: string,
): Promise<string> {
  try {
    const written = await writeSessionLog(deps, place, session);
    return isRefusal(written)
      ? `[BDK] verbose log not written: ${written.why}`
      : `[BDK] verbose log ${written.path}`;
  } catch (error) {
    return `[BDK] verbose log not written: ${error instanceof Error ? error.message : String(error)}`;
  }
}
