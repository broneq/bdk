// `bdk hooks session-end` (`kernel-cli/hooks`; T24 design D-14): the
// checkpoint core `change checkpoint` uses, run for the Change bound to the
// branch. The host ignores this event's output and exit code, so every
// outcome other than a commit is reported as a skip, never refused. The
// session's run marker goes first, with or without a Change (T41 design D2).
import { implicitCheckpoint, resolvedSettings } from "../../change/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import { removeRunMarker, resolveActiveChange } from "../../shared/store/index.ts";
import { sessionEndPayload } from "../domain/payload.ts";
import type { SessionEndReport } from "../domain/report.ts";
import { bdkProject } from "./agents.ts";
import type { HooksDeps } from "./input.ts";

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
