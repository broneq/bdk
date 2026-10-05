// The transcripts of one host session, read at the time of the call and never
// copied (design D3 of v3-t47-run-diagnostics): the main thread's file, and
// each subagent's file and `.meta.json` under `<session>/subagents/`.
import { basename, join } from "node:path";

import type { Store } from "../../shared/store/index.ts";
import type { TranscriptState } from "../domain/report.ts";
import { parseTranscript } from "../domain/transcript.ts";
import type { AgentTranscript, SessionTranscripts } from "../domain/transcript.ts";

/** Over this share of unknown lines, a session's transcripts are `unreadable`. */
const UNREADABLE_SHARE = 0.1;

const NONE: Omit<SessionTranscripts, "state"> = { unknownLines: 0, agents: [], cost: null };

/**
 * Reads the session whose main transcript is `mainPath` (null: the host gave
 * none). `expected` are agent transcript paths the journal names; one that is
 * gone makes the session `missing` while the files that exist are still read.
 */
export function readSession(
  store: Store,
  mainPath: string | null,
  expected: readonly string[] = [],
): SessionTranscripts {
  if (mainPath === null) return { ...NONE, state: "unavailable" };
  const mainText = store.read(mainPath);
  if (mainText === undefined) return { ...NONE, state: "missing" };

  const main = parseTranscript(mainText);
  const agents: AgentTranscript[] = [
    { agent: "main", type: null, toolUseId: null, path: mainPath, events: main.events },
  ];
  let unknown = main.unknown;
  let total = main.total;
  const directory = join(mainPath.slice(0, -".jsonl".length), "subagents");
  for (const name of store
    .list(directory)
    .filter((file) => /^agent-.+\.jsonl$/.test(file))
    .sort()) {
    const path = join(directory, name);
    const parsed = parseTranscript(store.read(path) ?? "");
    unknown += parsed.unknown;
    total += parsed.total;
    const meta = metaOf(store.read(path.replace(/\.jsonl$/, ".meta.json")));
    agents.push({
      agent: basename(name, ".jsonl").slice("agent-".length),
      type: meta.agentType,
      toolUseId: meta.toolUseId,
      path,
      events: parsed.events,
    });
  }
  const missing = expected.some((path) => !store.exists(path));
  const state: TranscriptState = missing
    ? "missing"
    : total > 0 && unknown / total > UNREADABLE_SHARE
      ? "unreadable"
      : "ok";
  return { state, unknownLines: unknown, agents, cost: main.cost };
}

const PERSISTED = /Full output saved to: (\S+)/;

/** A tool result the host moved to `tool-results/`: the saved file when it is still there. */
export function persistedOutput(store: Store, text: string): string {
  const path = text.startsWith("<persisted-output>") ? PERSISTED.exec(text)?.[1] : undefined;
  return (path === undefined ? undefined : store.read(path)) ?? text;
}

function metaOf(text: string | undefined): {
  readonly agentType: string | null;
  readonly toolUseId: string | null;
} {
  try {
    const value = JSON.parse(text ?? "") as { agentType?: unknown; toolUseId?: unknown };
    return {
      agentType: typeof value.agentType === "string" ? value.agentType : null,
      toolUseId: typeof value.toolUseId === "string" ? value.toolUseId : null,
    };
  } catch {
    return { agentType: null, toolUseId: null };
  }
}
