#!/usr/bin/env node
// Condense the transcripts of one probe run into a timeline, so the order of
// tool calls, agent messages and hook feedback can be read without the raw
// transcripts. Hook payloads carry none of this.
//
//   node timeline.mjs <run-dir> <out-file>
//
// Reads transcript_path from the first payload in <run-dir>, then the main
// transcript and every subagent transcript next to it
// (<session>/subagents/agent-<id>.jsonl).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const [dir, outFile] = process.argv.slice(2);
const first = readdirSync(dir).find((f) => /^\d+-\d+-.+\.json$/.test(f));
if (!first) process.exit(0);
const main = JSON.parse(readFileSync(join(dir, first), "utf8")).transcript_path;
if (!main || !existsSync(main)) process.exit(0);

const cut = (s, n = 240) => (s.length > n ? `${s.slice(0, n)}...` : s);
const textOf = (c) =>
  typeof c === "string"
    ? c
    : Array.isArray(c)
      ? c
          .map((b) => b.text ?? b.content ?? "")
          .map(textOf)
          .join(" ")
      : "";

const condense = (line) => {
  const m = JSON.parse(line);
  const at = m.timestamp;
  const content = m.message?.content;
  if (m.type === "assistant" && Array.isArray(content)) {
    return content
      .filter((b) => b.type === "tool_use" || b.type === "text")
      .map((b) =>
        b.type === "tool_use"
          ? { at, kind: "tool_use", tool: b.name, input: cut(JSON.stringify(b.input)) }
          : { at, kind: "text", text: cut(b.text) },
      );
  }
  if (m.type === "user") {
    if (Array.isArray(content) && content.some((b) => b.type === "tool_result")) {
      return content
        .filter((b) => b.type === "tool_result")
        .map((b) => ({ at, kind: "tool_result", text: cut(textOf(b.content)) }));
    }
    return [{ at, kind: "user", origin: m.origin ?? m.userType, text: cut(textOf(content), 600) }];
  }
  if (m.type === "attachment" || m.attachment) {
    return [
      {
        at,
        kind: "attachment",
        type: m.attachment?.type,
        text: cut(JSON.stringify(m.attachment ?? {}), 600),
      },
    ];
  }
  if (m.type === "system")
    return [{ at, kind: "system", subtype: m.subtype, text: cut(textOf(m.content ?? ""), 400) }];
  return [];
};

const read = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return condense(l);
      } catch {
        return [];
      }
    });

const subDir = join(main.replace(/\.jsonl$/, ""), "subagents");
const agents = existsSync(subDir) ? readdirSync(subDir).filter((f) => f.endsWith(".jsonl")) : [];
writeFileSync(
  outFile,
  JSON.stringify({
    hook_event_name: "Timeline",
    main: read(main),
    agents: Object.fromEntries(
      agents.map((f) => [basename(f, ".jsonl").replace(/^agent-/, ""), read(join(subDir, f))]),
    ),
  }),
);
