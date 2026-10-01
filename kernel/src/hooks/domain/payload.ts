// The host payloads the guards read (`kernel-cli/hooks`, Hook payloads), parsed
// without trusting their shape: a field that is absent or of the wrong type is
// undefined, and the guards decide what a missing field means.

export interface PreToolPayload {
  readonly tool: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** Present only in a subagent's payload (HOST-FACTS `main-no-agent-id`). */
  readonly agentId?: string;
  readonly agentType?: string;
  readonly cwd?: string;
}

export interface ExpansionPayload {
  readonly event?: string;
  readonly session?: string;
  readonly commandName?: string;
  /** `command_args`, or `command_input` (the hooks reference's name) when absent. */
  readonly args?: string;
  readonly expansionType?: string;
  readonly prompt?: string;
}

/** A `PostToolUse` payload of the tools the agent hooks read (HOST-FACTS `agent-link`, `stop-on-taskstop`). */
export interface PostToolPayload {
  readonly tool: string;
  readonly session?: string;
  readonly agentId?: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}

/** `SubagentStart`, `SubagentStop` and `Stop`: the fields the agent hooks read. */
export interface AgentEventPayload {
  readonly session?: string;
  readonly agentId?: string;
  readonly agentType?: string;
  readonly stopHookActive: boolean;
  /** `background_tasks` entries with `status: running`, by id. */
  readonly runningTasks: readonly string[];
}

export interface SessionEndPayload {
  readonly reason?: string;
}

/** The parsed JSON object, or the reason it is not one. */
function object(raw: string): Record<string, unknown> | string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return "is not JSON";
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "is not a JSON object";
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** A `PreToolUse` payload, or the missing field that makes it unknown. */
export function preToolPayload(raw: string): PreToolPayload | { readonly missing: string } {
  const data = object(raw);
  if (typeof data === "string") return { missing: `a JSON body (it ${data})` };
  const tool = text(data.tool_name);
  if (tool === undefined) return { missing: "tool_name" };
  const input = data.tool_input;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { missing: "tool_input" };
  }
  const agentId = text(data.agent_id);
  const agentType = text(data.agent_type);
  const cwd = text(data.cwd);
  return {
    tool,
    input: input as Record<string, unknown>,
    ...(agentId === undefined ? {} : { agentId }),
    ...(agentType === undefined ? {} : { agentType }),
    ...(cwd === undefined ? {} : { cwd }),
  };
}

/** A `UserPromptExpansion` payload; undefined when the body is not a JSON object. */
export function expansionPayload(raw: string): ExpansionPayload | undefined {
  const data = object(raw);
  if (typeof data === "string") return undefined;
  const args =
    typeof data.command_args === "string"
      ? data.command_args
      : typeof data.command_input === "string"
        ? data.command_input
        : undefined;
  return {
    ...present("event", text(data.hook_event_name)),
    ...present("session", text(data.session_id)),
    ...present("commandName", text(data.command_name)),
    ...present("args", args),
    ...present("expansionType", text(data.expansion_type)),
    ...present("prompt", text(data.prompt)),
  };
}

/** `{ [key]: value }`, or nothing when the value is absent (exact optional properties). */
function present<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

export function sessionEndPayload(raw: string): SessionEndPayload {
  const data = object(raw);
  if (typeof data === "string") return {};
  const reason = text(data.reason);
  return reason === undefined ? {} : { reason };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** A `PostToolUse` payload; undefined when the body is not a JSON object with `tool_name`. */
export function postToolPayload(raw: string): PostToolPayload | undefined {
  const data = object(raw);
  if (typeof data === "string") return undefined;
  const tool = text(data.tool_name);
  if (tool === undefined) return undefined;
  return {
    tool,
    ...present("session", text(data.session_id)),
    ...present("agentId", text(data.agent_id)),
    input: record(data.tool_input),
    response: record(data.tool_response),
  };
}

/** An agent lifecycle payload; undefined when the body is not a JSON object. */
export function agentEventPayload(raw: string): AgentEventPayload | undefined {
  const data = object(raw);
  if (typeof data === "string") return undefined;
  const tasks = Array.isArray(data.background_tasks) ? (data.background_tasks as unknown[]) : [];
  return {
    ...present("session", text(data.session_id)),
    ...present("agentId", text(data.agent_id)),
    ...present("agentType", text(data.agent_type)),
    stopHookActive: data.stop_hook_active === true,
    runningTasks: tasks
      .map(record)
      .filter((task) => task.status === "running")
      .map((task) => text(task.id))
      .filter((id): id is string => id !== undefined),
  };
}
