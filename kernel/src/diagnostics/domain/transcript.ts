// The host transcript as typed events (design D3 of v3-t47-run-diagnostics;
// HOST-FACTS `transcript-layout`). The format is not documented, so every
// line of a shape this parser does not know is counted, never guessed at.
// Thinking is dropped here, so no caller can print it.
import type { Cost, ModelTokens, TranscriptState } from "./report.ts";

interface Base {
  /** ISO time of the line; a line without one takes the previous line's. */
  readonly at: string;
  /** 1-based line of the transcript file, for a citation. */
  readonly line: number;
}

export type TranscriptEvent = Base &
  (
    | { readonly kind: "prompt"; readonly text: string }
    | { readonly kind: "text"; readonly text: string }
    | {
        readonly kind: "tool-use";
        readonly id: string;
        readonly name: string;
        readonly input: unknown;
      }
    | {
        readonly kind: "tool-result";
        readonly id: string;
        readonly text: string;
        readonly error: boolean;
      }
    | { readonly kind: "skill"; readonly name: string; readonly text: string }
    | { readonly kind: "attachment"; readonly type: string; readonly text: string | null }
    | {
        readonly kind: "usage";
        readonly requestId: string;
        readonly model: string;
        readonly tokens: ModelTokens;
      }
  );

export interface ParsedTranscript {
  readonly events: readonly TranscriptEvent[];
  /** Lines of a shape the parser does not know. */
  readonly unknown: number;
  readonly total: number;
  /** The last `cost-state` line's session cost, or null. */
  readonly cost: Cost | null;
}

export interface AgentTranscript {
  /** `main` for the main thread, else the host's agent id. */
  readonly agent: string;
  readonly type: string | null;
  /** The `Agent` tool use that started it, from its `.meta.json`. */
  readonly toolUseId: string | null;
  readonly path: string;
  readonly events: readonly TranscriptEvent[];
}

export interface SessionTranscripts {
  readonly state: TranscriptState;
  readonly unknownLines: number;
  /** The main thread first, then the subagents by file name. */
  readonly agents: readonly AgentTranscript[];
  readonly cost: Cost | null;
}

/** Host bookkeeping lines with nothing to report. */
const SKIPPED = new Set([
  "system",
  "last-prompt",
  "queue-operation",
  "atis-latch",
  "summary",
  "file-history-snapshot",
  "custom-title",
  "agent-name",
  "tag",
]);

const SKILL_BASE = /^Base directory for this skill: (\S+)/;

type Json = Readonly<Record<string, unknown>>;

export function parseTranscript(text: string): ParsedTranscript {
  const events: TranscriptEvent[] = [];
  const requests = new Set<string>();
  const skillOf = new Map<string, string>();
  let unknown = 0;
  let total = 0;
  let cost: Cost | null = null;
  let at = "";
  const lines = text.split("\n");
  for (const [index, raw] of lines.entries()) {
    if (raw.trim() === "") continue;
    total += 1;
    const entry = parseLine(raw);
    if (entry === undefined || typeof entry.type !== "string") {
      unknown += 1;
      continue;
    }
    if (typeof entry.timestamp === "string") at = entry.timestamp;
    const base = { at, line: index + 1 };
    if (entry.type === "cost-state") {
      const parsed = costOf(entry);
      if (parsed === undefined) unknown += 1;
      else cost = parsed;
      continue;
    }
    if (SKIPPED.has(entry.type)) continue;
    const found =
      entry.type === "assistant"
        ? assistantEvents(entry, base, requests, skillOf)
        : entry.type === "user"
          ? userEvents(entry, base, skillOf)
          : entry.type === "attachment"
            ? attachmentEvents(entry, base)
            : undefined;
    if (found === undefined) unknown += 1;
    else events.push(...found);
  }
  return { events, unknown, total, cost };
}

function parseLine(raw: string): Json | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function assistantEvents(
  entry: Json,
  base: Base,
  requests: Set<string>,
  skillOf: Map<string, string>,
): TranscriptEvent[] | undefined {
  const message = entry.message;
  if (!isObject(message) || !Array.isArray(message.content)) return undefined;
  const events: TranscriptEvent[] = [];
  for (const block of message.content) {
    if (!isObject(block)) continue;
    if (block.type === "text" && typeof block.text === "string") {
      events.push({ ...base, kind: "text", text: block.text });
    } else if (
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
      if (
        block.name === "Skill" &&
        isObject(block.input) &&
        typeof block.input.skill === "string"
      ) {
        skillOf.set(block.id, block.input.skill);
      }
    }
    // Thinking and redacted thinking are never kept.
  }
  const requestId = typeof entry.requestId === "string" ? entry.requestId : undefined;
  if (requestId !== undefined && isObject(message.usage) && !requests.has(requestId)) {
    requests.add(requestId);
    events.push({
      ...base,
      kind: "usage",
      requestId,
      model: typeof message.model === "string" ? message.model : "unknown",
      tokens: tokensOf(message.usage),
    });
  }
  return events;
}

function userEvents(
  entry: Json,
  base: Base,
  skillOf: ReadonlyMap<string, string>,
): TranscriptEvent[] | undefined {
  const message = entry.message;
  if (!isObject(message)) return undefined;
  if (typeof message.content === "string")
    return [{ ...base, kind: "prompt", text: message.content }];
  if (!Array.isArray(message.content)) return undefined;
  const events: TranscriptEvent[] = [];
  for (const block of message.content) {
    if (!isObject(block)) continue;
    if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
      events.push({
        ...base,
        kind: "tool-result",
        id: block.tool_use_id,
        text: resultText(block.content),
        error: block.is_error === true,
      });
    } else if (block.type === "text" && typeof block.text === "string") {
      events.push(textEvent(entry, base, block.text, skillOf));
    }
  }
  return events;
}

/** A user text block: a skill load, other host text (`isMeta`), or what the user typed. */
function textEvent(
  entry: Json,
  base: Base,
  text: string,
  skillOf: ReadonlyMap<string, string>,
): TranscriptEvent {
  if (entry.isMeta !== true) return { ...base, kind: "prompt", text };
  const source =
    typeof entry.sourceToolUseID === "string" ? skillOf.get(entry.sourceToolUseID) : undefined;
  const directory = SKILL_BASE.exec(text)?.[1];
  const name = source ?? directory?.split("/").filter(Boolean).at(-1);
  return name === undefined
    ? { ...base, kind: "attachment", type: "meta", text }
    : { ...base, kind: "skill", name, text };
}

function attachmentEvents(entry: Json, base: Base): TranscriptEvent[] | undefined {
  const attachment = entry.attachment;
  if (!isObject(attachment) || typeof attachment.type !== "string") return undefined;
  const content = attachment.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content) && content.every((item) => typeof item === "string")
        ? content.join("\n")
        : null;
  return [{ ...base, kind: "attachment", type: attachment.type, text }];
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) =>
      isObject(block) && block.type === "text" && typeof block.text === "string"
        ? block.text
        : `[${isObject(block) && typeof block.type === "string" ? block.type : "block"}]`,
    )
    .join("\n");
}

function tokensOf(usage: Json): ModelTokens {
  const count = (key: string) => {
    const value = usage[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    input: count("input_tokens"),
    output: count("output_tokens"),
    cacheRead: count("cache_read_input_tokens"),
    cacheWrite: count("cache_creation_input_tokens"),
  };
}

function costOf(entry: Json): Cost | undefined {
  if (typeof entry.totalCostUSD !== "number" || !isObject(entry.modelUsage)) return undefined;
  const byModel: Record<string, number> = {};
  for (const [model, usage] of Object.entries(entry.modelUsage)) {
    if (!isObject(usage) || typeof usage.costUSD !== "number") return undefined;
    byModel[model] = usage.costUSD;
  }
  return { totalUSD: entry.totalCostUSD, byModel };
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
