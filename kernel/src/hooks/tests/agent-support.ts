// The agent registry harness of the T41 unit tests: a memory repository with
// the hooks, agents, graph and log commands on one clock the tests move, the
// heartbeats in a map, and the hook payloads in the recorded 2.1.284 shapes.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };

import { agentsRegistrations } from "../../agents/index.ts";
import { graphRegistrations } from "../../graph/index.ts";
import { withPluginFiles } from "../../graph/tests/support.ts";
import { logRegistrations } from "../../log/index.ts";
import {
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  sequentialRandom,
  writePackage,
} from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import type { Clock } from "../../shared/clock/index.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import {
  agentsRegistryPath,
  memoryIndex,
  memoryRegistry,
  writeDocument,
} from "../../shared/store/index.ts";
import type { Heartbeat, Store } from "../../shared/store/index.ts";
import { hooksRegistrations } from "../index.ts";
import type { HooksDeps } from "../index.ts";

export const SESSION = "sess-1";
/** A non-BDK agent that starts agents itself; no guard checks its spawns. */
export const PARENT = "a9f8e7d6c5b4a3f2e";
export const WORKER = "a1b2c3d4e5f6a7b8c";
export const SCOUT = "a5e4d3c2b1a0f9e8d";
export const TICKET = "A-00000001";
export const T0 = Date.parse("2026-09-25T10:00:00.000Z");
export const PACKAGE = `.bdk/changes/${CHANGE}/dispatch/02-implementer-${TICKET}.md`;

export interface Harness {
  readonly store: Store;
  readonly deps: HooksDeps;
  readonly beats: Record<string, Heartbeat>;
  /** Moves the clock `seconds` forward. */
  tick(seconds: number): void;
  run(argv: readonly string[], payload?: unknown): ReturnType<typeof runBdk>;
}

export function harness(settings = ""): Harness {
  const store = withPluginFiles(repository());
  if (settings !== "") store.write(`${ROOT}/.bdk/settings.yaml`, settings);
  // The agents commands read an existing registry only; the memory one needs its file.
  store.write(agentsRegistryPath(ROOT), "");
  const git = fakeGit();
  let now = T0;
  const clock: Clock = { now: () => new Date(now).toISOString() };
  const beats: Record<string, Heartbeat> = {};
  const deps: HooksDeps = {
    store,
    git,
    openIndex: memoryIndex,
    openRegistry: memoryRegistry((id) => beats[id]),
    clock,
    random: sequentialRandom(),
    pluginRoot: "/plugins/bdk",
    settings: settingsRegistry(),
    commands: loadIndex(commands),
  };
  const registrations = [
    ...hooksRegistrations(deps),
    ...agentsRegistrations({
      ...deps,
      sleep: (ms) => {
        now += ms;
        return Promise.resolve();
      },
    }),
    ...graphRegistrations(deps),
    ...logRegistrations(deps),
  ];
  return {
    store,
    deps,
    beats,
    tick: (seconds) => {
      now += seconds * 1000;
    },
    run: (argv, payload) =>
      runBdk(
        registrations,
        store,
        git,
        argv,
        payload === undefined
          ? ""
          : typeof payload === "string"
            ? payload
            : JSON.stringify(payload),
      ),
  };
}

export function openTicket(
  store: Store,
  ticket: string,
  target: string,
  loop = "part",
  closed = false,
): void {
  writeDocument(store, `${DIR}/attempts/${loop}-${target}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop,
      target,
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
      ...(closed ? { "closed-at": "2026-09-25T10:20:00.000Z", outcome: "ok" } : {}),
    },
    body: "",
  });
}

export function spawn(
  parent: string | undefined,
  child: string,
  type: string,
  prompt: string,
  status = "async_launched",
  parentType = "bdk:worker",
) {
  return {
    session_id: SESSION,
    ...(parent === undefined ? {} : { agent_id: parent, agent_type: parentType }),
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_input: { subagent_type: type, prompt, description: "d" },
    tool_response: { status, agentId: child },
  };
}

export const start = (id: string, type: string) => ({
  session_id: SESSION,
  agent_id: id,
  agent_type: type,
  hook_event_name: "SubagentStart",
});

export const agentStop = (id: string, type: string, running: readonly string[] = []) => ({
  session_id: SESSION,
  agent_id: id,
  agent_type: type,
  hook_event_name: "SubagentStop",
  stop_hook_active: false,
  background_tasks: [id, ...running].map((task) => ({ id: task, status: "running" })),
});

export const mainStop = (running: readonly string[] = []) => ({
  session_id: SESSION,
  hook_event_name: "Stop",
  background_tasks: running.map((task) => ({ id: task, status: "running" })),
});

/** The main thread's worker on ticket A-00000001 (part 02), started. */
export async function tree(h: Harness): Promise<void> {
  openTicket(h.store, TICKET, "02");
  writePackage(h.store, TICKET, "implementer", "02");
  await h.run(["hooks", "post-tool"], spawn(undefined, WORKER, "bdk:worker", `Read ${PACKAGE}.`));
  await h.run(["hooks", "subagent-start"], start(WORKER, "bdk:worker"));
}

/** `tree`, and a scout the worker started with a question. */
export async function scouted(h: Harness): Promise<void> {
  await tree(h);
  await h.run(
    ["hooks", "post-tool"],
    spawn(WORKER, SCOUT, "bdk:scout", "Where is the token parsed?"),
  );
  await h.run(["hooks", "subagent-start"], start(SCOUT, "bdk:scout"));
}

export async function show(h: Harness, id: string) {
  return (await h.run(["agents", "show", id, "--json"])).json as Record<string, unknown>;
}
