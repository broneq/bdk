// The host's hook payload (spec `bdk-cli/hooks`, "Hook payload input"), read without trusting its
// shape: a field that is absent or of another type is undefined, and the use cases decide what a
// missing field means.

export interface HookPayload {
  readonly tool?: string;
  /** `tool_input.command` of a `Bash` call. */
  readonly command?: string;
  /** Present only inside a subagent, also when the main thread runs as an agent (`--agent`). */
  readonly agentId?: string;
  readonly agentType?: string;
  readonly cwd?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The payload's fields, or undefined when `raw` is not one JSON object. */
export function parsePayload(raw: string): HookPayload | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const payload = object(value);
  if (payload === undefined) return undefined;
  const fields: Record<string, string | undefined> = {
    tool: text(payload.tool_name),
    command: text(object(payload.tool_input)?.command),
    agentId: text(payload.agent_id),
    agentType: text(payload.agent_type),
    cwd: text(payload.cwd),
  };
  const present: Record<string, string> = {};
  for (const [name, field] of Object.entries(fields))
    if (field !== undefined) present[name] = field;
  return present;
}
