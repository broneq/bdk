// The run journal and verbose lines of the hooks (`kernel-cli/hooks`, Run
// journal and verbose lines; design D2, D4 of v3-t47-run-diagnostics). A
// failed write never changes a hook's output, and outside a BDK project
// nothing is written: `appendJournal` never creates `.bdk/`.
import { join } from "node:path";

import { appendLiveLog, liveLines } from "../../diagnostics/index.ts";
import { readKernelVersion } from "../../shared/config/index.ts";
import { appendJournal } from "../../shared/store/index.ts";
import { questionCount, sessionStartPayload } from "../domain/payload.ts";
import type { PostToolPayload } from "../domain/payload.ts";
import type { PostToolReport } from "../domain/report.ts";
import { bdkProject } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";

/** A session id safe as a file name; the host's are UUIDs. */
const SESSION_NAME = /^[A-Za-z0-9_-]+$/;

/** The marker `post-tool.sh` and `session-end` test for the verbose log. */
export function verboseMarkerPath(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "verbose");
}

export function verboseOn(deps: Pick<HooksDeps, "store">, projectRoot: string): boolean {
  return deps.store.exists(verboseMarkerPath(projectRoot));
}

/** `session-start`: the `session` line with the transcript path and the BDK version. */
export async function journalSession(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<void> {
  const projectRoot = bdkProject(deps, place);
  const payload = sessionStartPayload(raw);
  if (projectRoot === undefined || payload.session === undefined) return;
  await appendJournal(deps.store, projectRoot, {
    v: 1,
    kind: "session",
    at: deps.clock.now(),
    session: payload.session,
    transcript: payload.transcript ?? null,
    source: payload.source ?? null,
    bdk: readKernelVersion(deps.store, deps.pluginRoot),
    commit: await pluginCommit(deps),
    host: payload.host ?? null,
  });
}

/** The commit of a plugin run from a git checkout (`--plugin-dir`); null for a release. */
async function pluginCommit(deps: HooksDeps): Promise<string | null> {
  if (!deps.store.exists(join(deps.pluginRoot, ".git"))) return null;
  try {
    const result = await deps.git.run(["rev-parse", "--short", "HEAD"], deps.pluginRoot);
    return result.code === 0 && result.stdout.trim() !== "" ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

export async function journalAgentStart(
  deps: HooksDeps,
  projectRoot: string,
  agent: { id: string; type: string; parent: string | null; ticket: string | null },
  session: string | undefined,
): Promise<void> {
  await appendJournal(deps.store, projectRoot, {
    v: 1,
    kind: "agent-start",
    at: deps.clock.now(),
    agent: agent.id,
    type: agent.type,
    parent: agent.parent,
    ticket: agent.ticket,
    session: session ?? null,
  });
}

export async function journalAgentStop(
  deps: HooksDeps,
  projectRoot: string,
  stop: {
    agent: string;
    by: "subagent-stop" | "agent-result" | "task-stop";
    transcript: string | undefined;
  },
  session: string | undefined,
): Promise<void> {
  await appendJournal(deps.store, projectRoot, {
    v: 1,
    kind: "agent-stop",
    at: deps.clock.now(),
    agent: stop.agent,
    transcript: stop.transcript ?? null,
    by: stop.by,
    session: session ?? null,
  });
}

/** `post-tool`: the end the report records, a question line, and the live line with the marker. */
export async function journalPostTool(
  deps: HooksDeps,
  projectRoot: string,
  payload: PostToolPayload,
  report: PostToolReport,
): Promise<void> {
  if (report.ended !== null) {
    await journalAgentStop(
      deps,
      projectRoot,
      { ...report.ended, transcript: undefined },
      payload.session,
    );
  }
  const count = payload.tool === "AskUserQuestion" ? questionCount(payload.input) : 0;
  if (count > 0) {
    await appendJournal(deps.store, projectRoot, {
      v: 1,
      kind: "question",
      at: deps.clock.now(),
      agent: payload.agentId ?? "main",
      count,
      session: payload.session ?? null,
    });
  }
  const { session } = payload;
  if (session === undefined || !SESSION_NAME.test(session) || !verboseOn(deps, projectRoot)) return;
  try {
    appendLiveLog(
      deps.store,
      projectRoot,
      session,
      liveLines({
        at: deps.clock.now(),
        agent: payload.agentId ?? "main",
        agentType: payload.agentType ?? null,
        tool: payload.tool,
        input: payload.input,
        response: payload.response,
        failed: payload.failed,
        error: payload.error ?? null,
      }),
    );
  } catch {
    // The live log is diagnostics: losing a line never fails the hook.
  }
}
