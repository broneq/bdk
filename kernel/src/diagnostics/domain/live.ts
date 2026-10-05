// One line of the verbose live log (`kernel-cli/hooks`, Run journal and
// verbose lines): what `hooks post-tool` saw of one tool call, without
// thinking or model text, which only the render of the transcripts holds.
import { toolInputLine } from "./log.ts";

const INPUT_CHARS = 200;
const RESULT_LINES = 3;

export interface LiveEntry {
  readonly at: string;
  /** The payload's `agent_id`, or `main`. */
  readonly agent: string;
  readonly agentType: string | null;
  readonly tool: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
  /** A `PostToolUseFailure` payload. */
  readonly failed: boolean;
  readonly error: string | null;
}

/** The entry's head line, then up to 3 result lines indented by four spaces. */
export function liveLines(entry: LiveEntry): string[] {
  const who = entry.agentType === null ? entry.agent : `${entry.agent} ${entry.agentType}`;
  const head = `${localClock(entry.at)} ${who} ${entry.tool} ${toolInputLine(entry.input, INPUT_CHARS)}`;
  const [status, result] = entry.failed
    ? ["failed", entry.error ?? ""]
    : [entry.error ?? "ok", resultText(entry.response)];
  const lines = result.split("\n").filter((line) => line.trim() !== "");
  return [`${head} ${status}`, ...lines.slice(0, RESULT_LINES).map((line) => `    ${line}`)];
}

/** The output the tool returned: Bash's stdout and stderr, a text content, else the JSON. */
function resultText(response: Readonly<Record<string, unknown>>): string {
  const streams = [response.stdout, response.stderr].filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  if (streams.length > 0) return streams.join("\n");
  const { content } = response;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (block as { text?: unknown } | null)?.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n");
  }
  return Object.keys(response).length === 0 ? "" : JSON.stringify(response);
}

/** `HH:MM:SS` in the machine's time zone: the live log is read while the run goes on. */
function localClock(at: string): string {
  const time = new Date(at);
  if (Number.isNaN(time.getTime())) return "--:--:--";
  return [time.getHours(), time.getMinutes(), time.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
