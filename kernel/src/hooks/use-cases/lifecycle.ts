// `bdk hooks post-tool` and `bdk hooks subagent-start` (`kernel-cli/hooks`;
// T41-D6): the parent's `PostToolUse` on `Agent` links a child with its
// package (HOST-FACTS `agent-link`), a foreground result or a `TaskStop` ends
// it, and `SubagentStart` completes the row and hands a BDK agent its
// identity (HOST-FACTS `start-context`). Outside a BDK project nothing is
// written; a hook never fails the host's event.
import { isAbsolute, join, relative } from "node:path";

import {
  endStaleSessions,
  leaseOf,
  recordEnd,
  recordLink,
  recordStart,
} from "../../agents/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import { dispatchPaths } from "../domain/guards.ts";
import { agentEventPayload, postToolPayload } from "../domain/payload.ts";
import type { PostToolReport, SubagentStartReport } from "../domain/report.ts";
import { bdkProject, onRegistry, registryExists, settingsOf } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";

export async function postTool(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<PostToolReport> {
  const payload = postToolPayload(raw);
  const none = { tool: payload?.tool ?? "", linked: null, ended: null };
  const projectRoot = bdkProject(deps, place);
  if (payload === undefined || projectRoot === undefined) return none;
  const at = deps.clock.now();

  if (payload.tool === "TaskStop") {
    const id = text(payload.input.task_id);
    if (id === undefined || payload.response.task_type !== "local_agent") return none;
    return onRegistry(deps, projectRoot, (registry) => {
      if (registry.get(id) === undefined) return none;
      recordEnd(registry, id, "task-stop", at);
      return { ...none, ended: { agent: id, by: "task-stop" as const } };
    });
  }
  if (payload.tool !== "Agent") return none;
  const child = text(payload.response.agentId);
  if (child === undefined) return none;
  const parent = payload.agentId ?? "main";
  const pack = packageOf(deps, projectRoot, text(payload.input.prompt) ?? "");
  const type = text(payload.input.subagent_type);
  const completed = payload.response.status === "completed";
  return onRegistry(deps, projectRoot, (registry) =>
    registry.transaction(() => {
      recordLink(registry, {
        id: child,
        parent,
        at,
        ...(payload.session === undefined ? {} : { session: payload.session }),
        ...(type === undefined ? {} : { type }),
        ...pack,
      });
      if (completed) recordEnd(registry, child, "agent-result", at);
      return {
        tool: payload.tool,
        linked: { agent: child, parent, ticket: pack.ticket ?? null },
        ended: completed ? { agent: child, by: "agent-result" as const } : null,
      };
    }),
  );
}

export async function subagentStart(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<SubagentStartReport> {
  const payload = agentEventPayload(raw);
  const none = { agent: payload?.agentId ?? null, parent: null, package: null, context: null };
  const projectRoot = bdkProject(deps, place);
  const id = payload?.agentId;
  if (payload === undefined || id === undefined || projectRoot === undefined) return none;
  const row = await onRegistry(deps, projectRoot, (registry) =>
    recordStart(registry, {
      id,
      at: deps.clock.now(),
      ...(payload.agentType === undefined ? {} : { type: payload.agentType }),
      ...(payload.session === undefined ? {} : { session: payload.session }),
    }),
  );
  if (!(payload.agentType ?? "").startsWith("bdk:")) return none;
  const lines = [
    `BDK-AGENT-ID: ${id}`,
    ...(row.parent === null ? [] : [`BDK-PARENT: ${row.parent}`]),
    ...(row.package === null ? [] : [`BDK-PACKAGE: ${row.package}`]),
    ...(row.ticket === null ? [] : [`BDK-TICKET: ${row.ticket}`]),
  ];
  return { agent: id, parent: row.parent, package: row.package, context: lines.join("\n") };
}

/**
 * `session-start`: ends, as `stale`, the agents of other sessions silent for
 * longer than `agents.ttl`, so a crashed session leaves none `running`.
 */
export async function endStaleAgents(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<readonly string[]> {
  const projectRoot = bdkProject(deps, place);
  if (projectRoot === undefined || !registryExists(deps, projectRoot)) return [];
  const settings = settingsOf(deps, projectRoot, place);
  if (settings === undefined) return [];
  const session = agentEventPayload(raw)?.session;
  const at = deps.clock.now();
  return onRegistry(deps, projectRoot, (registry) =>
    endStaleSessions(registry, session, Date.parse(at), leaseOf(settings), at),
  );
}

/** The one dispatch package a prompt names, relative to the project root, with its ticket and target. */
function packageOf(
  deps: HooksDeps,
  projectRoot: string,
  prompt: string,
): { package?: string; ticket?: string; target?: string } {
  const paths = dispatchPaths(prompt);
  const [written] = paths;
  if (paths.length !== 1 || written === undefined) return {};
  const absolute = isAbsolute(written) ? written : join(projectRoot, written);
  const path = relative(projectRoot, absolute);
  try {
    const document = readDocument(deps.store, absolute);
    if (document?.kind !== "dispatch" || !("data" in document)) return { package: path };
    const data = document.data as { ticket?: unknown; target?: unknown };
    return {
      package: path,
      ...(typeof data.ticket === "string" ? { ticket: data.ticket } : {}),
      ...(typeof data.target === "string" ? { target: data.target } : {}),
    };
  } catch {
    return { package: path };
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
