// One host transcript (Claude Code's JSON Lines) as the events diagnostics counts. The format is
// not documented, so a line of a shape this parser does not know is counted, never guessed at
// (design D9). Text is kept only where a detector classifies it; thinking is never kept.

export interface Tokens {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
}

interface Base {
  /** ISO time of the line; a line without one takes the previous line's. */
  readonly at: string;
  /** 1-based line of the transcript file, for a citation. */
  readonly line: number;
}

export type ToolUse = Base & {
  readonly kind: "tool-use";
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
};

export type ToolResult = Base & {
  readonly kind: "tool-result";
  readonly id: string;
  readonly error: boolean;
  /** The first line of the result text, for classification only; never rendered. */
  readonly head: string;
};

export type Usage = Base & {
  readonly kind: "usage";
  readonly requestId: string;
  readonly model: string;
  readonly tokens: Tokens;
};

export type TranscriptEvent = ToolUse | ToolResult | Usage;

export interface HostCost {
  readonly totalUSD: number;
  /** Per model name as the host writes it. */
  readonly byModel: Readonly<Record<string, number>>;
}

export interface Transcript {
  readonly events: readonly TranscriptEvent[];
  readonly first: string | null;
  readonly last: string | null;
  /** Non-empty lines of the file. */
  readonly lines: number;
  /** Lines that are not JSON or not of a shape this parser knows. */
  readonly unknown: number;
  /** The last `cost-state` line, or null (the session had not ended, or crashed). */
  readonly cost: HostCost | null;
}

/** Host bookkeeping lines that carry nothing diagnostics counts. */
const SKIPPED: ReadonlySet<string> = new Set([
  "system",
  "attachment",
  "last-prompt",
  "queue-operation",
  "atis-latch",
  "summary",
  "file-history-snapshot",
  "custom-title",
  "agent-name",
  "tag",
  "progress",
  "pr-link",
]);

type Json = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLine(raw: string): Json | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function count(record: Json, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function tokensOf(usage: Json): Tokens {
  const write = count(usage, "cache_creation_input_tokens");
  const split = isObject(usage.cache_creation) ? usage.cache_creation : undefined;
  const hour = split === undefined ? 0 : count(split, "ephemeral_1h_input_tokens");
  return {
    input: count(usage, "input_tokens"),
    output: count(usage, "output_tokens"),
    cacheRead: count(usage, "cache_read_input_tokens"),
    cacheWrite5m: Math.max(0, write - hour),
    cacheWrite1h: hour,
  };
}

function costOf(entry: Json): HostCost | undefined {
  if (typeof entry.totalCostUSD !== "number") return undefined;
  const byModel: Record<string, number> = {};
  if (isObject(entry.modelUsage)) {
    for (const [model, usage] of Object.entries(entry.modelUsage)) {
      if (isObject(usage) && typeof usage.costUSD === "number") byModel[model] = usage.costUSD;
    }
  }
  return { totalUSD: entry.totalCostUSD, byModel };
}

function resultHead(content: unknown): string {
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((block) => (isObject(block) && typeof block.text === "string" ? block.text : ""))
            .join("\n")
        : "";
  return (text.trim().split("\n")[0] ?? "").slice(0, 300);
}

function assistantEvents(entry: Json, base: Base): TranscriptEvent[] | undefined {
  const message = entry.message;
  if (!isObject(message) || !Array.isArray(message.content)) return undefined;
  const events: TranscriptEvent[] = [];
  for (const block of message.content) {
    if (
      isObject(block) &&
      block.type === "tool_use" &&
      typeof block.id === "string" &&
      typeof block.name === "string"
    ) {
      events.push({
        ...base,
        kind: "tool-use",
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }
  if (typeof entry.requestId === "string" && isObject(message.usage)) {
    events.push({
      ...base,
      kind: "usage",
      requestId: entry.requestId,
      model: typeof message.model === "string" ? message.model : "unknown",
      tokens: tokensOf(message.usage),
    });
  }
  return events;
}

function userEvents(entry: Json, base: Base): TranscriptEvent[] | undefined {
  const message = entry.message;
  if (!isObject(message)) return undefined;
  if (typeof message.content === "string") return [];
  if (!Array.isArray(message.content)) return undefined;
  const events: TranscriptEvent[] = [];
  for (const block of message.content) {
    if (isObject(block) && block.type === "tool_result" && typeof block.tool_use_id === "string") {
      events.push({
        ...base,
        kind: "tool-result",
        id: block.tool_use_id,
        error: block.is_error === true,
        head: resultHead(block.content),
      });
    }
  }
  return events;
}

/**
 * Parses a transcript. A request spans several lines with the same `requestId`, and its usage
 * grows as the reply streams, so only its last usage line counts.
 */
export function parseTranscript(text: string): Transcript {
  const events: TranscriptEvent[] = [];
  const lastUsage = new Map<string, number>();
  let lines = 0;
  let unknown = 0;
  let cost: HostCost | null = null;
  let at = "";
  let first: string | null = null;
  for (const [index, raw] of text.split("\n").entries()) {
    if (raw.trim() === "") continue;
    lines += 1;
    const entry = parseLine(raw);
    if (entry === undefined || typeof entry.type !== "string") {
      unknown += 1;
      continue;
    }
    if (typeof entry.timestamp === "string") {
      at = entry.timestamp;
      first ??= at;
    }
    if (entry.type === "cost-state") {
      const parsed = costOf(entry);
      if (parsed === undefined) unknown += 1;
      else cost = parsed;
      continue;
    }
    if (SKIPPED.has(entry.type)) continue;
    const base = { at, line: index + 1 };
    const found =
      entry.type === "assistant"
        ? assistantEvents(entry, base)
        : entry.type === "user"
          ? userEvents(entry, base)
          : undefined;
    if (found === undefined) {
      unknown += 1;
      continue;
    }
    for (const event of found) {
      if (event.kind === "usage") {
        const earlier = lastUsage.get(event.requestId);
        if (earlier !== undefined) events.splice(earlier, 1, event);
        else {
          lastUsage.set(event.requestId, events.length);
          events.push(event);
        }
      } else events.push(event);
    }
  }
  return { events, first, last: at === "" ? null : at, lines, unknown, cost };
}
