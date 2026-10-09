// Builders of transcript lines in the host's JSON Lines shape, for the domain and use-case tests.

let next = 0;

export function assistant(
  at: string,
  content: readonly unknown[],
  usage: Readonly<Record<string, unknown>> | null = { input_tokens: 10, output_tokens: 2 },
  options: { readonly requestId?: string; readonly model?: string } = {},
): string {
  next += 1;
  return JSON.stringify({
    type: "assistant",
    timestamp: at,
    requestId: options.requestId ?? `req_${String(next)}`,
    message: {
      model: options.model ?? "claude-sonnet-5-5",
      role: "assistant",
      content,
      ...(usage === null ? {} : { usage }),
    },
  });
}

export function toolUse(id: string, name: string, input: unknown): unknown {
  return { type: "tool_use", id, name, input };
}

export function bash(id: string, command: string): unknown {
  return toolUse(id, "Bash", { command });
}

export function result(at: string, id: string, text: string, error = false): string {
  return JSON.stringify({
    type: "user",
    timestamp: at,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: text, is_error: error }],
    },
  });
}

export function prompt(at: string, text: string): string {
  return JSON.stringify({ type: "user", timestamp: at, message: { role: "user", content: text } });
}

export function costState(totalCostUSD: number, models: Readonly<Record<string, number>>): string {
  return JSON.stringify({
    type: "cost-state",
    totalCostUSD,
    modelUsage: Object.fromEntries(
      Object.entries(models).map(([model, costUSD]) => [model, { costUSD }]),
    ),
  });
}

export function meta(agentType: string, description: string, toolUseId: string): string {
  return JSON.stringify({ agentType, description, toolUseId, spawnDepth: 1 });
}

export function jsonl(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}
