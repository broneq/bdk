// The host transcripts `bdk diagnostics report` reads: `<session>.jsonl` and, per subagent,
// `<session>/subagents/agent-<id>.jsonl` with its `.meta.json`. Read only.

import { join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";
import type { SessionFiles, SubagentFiles } from "../domain/session.ts";
import { parseTranscript } from "../domain/transcript.ts";

const SESSION = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;
const AGENT = /^agent-([A-Za-z0-9_-]+)\.(jsonl|meta\.json)$/;

/** The session ids of the directory, sorted; undefined when the directory does not exist. */
export function sessionIds(files: Files, dir: string): string[] | undefined {
  const entries = files.list(dir);
  if (entries === undefined) return undefined;
  return entries.flatMap((entry) => {
    const match = entry.dir ? null : SESSION.exec(entry.name);
    return match?.[1] === undefined ? [] : [match[1]];
  });
}

export function readMainText(files: Files, dir: string, id: string): string | undefined {
  return files.readText(join(dir, `${id}.jsonl`));
}

function metaOf(text: string | undefined): SubagentFiles["meta"] {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const string = (key: string): string | null =>
      typeof record[key] === "string" ? record[key] : null;
    return {
      agentType: string("agentType"),
      description: string("description"),
      toolUseId: string("toolUseId"),
    };
  } catch {
    return null;
  }
}

export function readSession(files: Files, dir: string, id: string, mainText: string): SessionFiles {
  const subDir = join(id, "subagents");
  const ids = new Set<string>();
  for (const entry of files.list(join(dir, subDir)) ?? []) {
    const match = entry.dir ? null : AGENT.exec(entry.name);
    if (match?.[1] !== undefined) ids.add(match[1]);
  }
  const subagents = [...ids].sort().map((agent): SubagentFiles => {
    const file = join(subDir, `agent-${agent}.jsonl`);
    const text = files.readText(join(dir, file));
    return {
      id: agent,
      file,
      transcript: text === undefined ? null : parseTranscript(text),
      meta: metaOf(files.readText(join(dir, subDir, `agent-${agent}.meta.json`))),
    };
  });
  return { id, file: `${id}.jsonl`, main: parseTranscript(mainText), subagents };
}
