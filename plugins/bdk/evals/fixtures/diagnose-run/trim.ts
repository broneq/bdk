// Trims a recorded session's transcripts for the diagnose-run fixture, line for line, so every
// citation into the original still resolves: thinking text, long tool output and hook context
// are cut, the host's context attachments are emptied, and the recording machine's paths,
// user name and email addresses are replaced. Usage (see evals/README.md):
//   node trim.ts <transcripts dir> <session id> <out dir> <recording root>

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";

const MAX_TEXT = 600;

const [source, session, out, root] = process.argv.slice(2);
if (source === undefined || session === undefined || out === undefined || root === undefined) {
  throw new Error("usage: node trim.ts <transcripts dir> <session id> <out dir> <recording root>");
}
const recording: string = root;
const home = process.env.HOME ?? "/nonexistent";
const user = userInfo().username;
const EMAIL = /[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Host scratch directories (macOS: /private/tmp/claude-<uid>/...).
const HOST_TMP = /(?:\/private)?\/tmp\/claude-\d+\/[^\s"'`]*/g;

function cut(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}[...trimmed]` : text;
}

function walk(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    // macOS reports /private/tmp/... and /tmp/... for the same directory.
    const replaced = value
      .split(recording)
      .join("/work/tally")
      .split(recording.replace(/^\/private\//, "/"))
      .join("/work/tally")
      .split(home)
      .join("/home/dev")
      .replace(HOST_TMP, "/tmp/host")
      .replace(EMAIL, "dev@example.com")
      .split(user)
      .join("dev");
    return key === "thinking" || key === "signature" ? "" : cut(replaced);
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, key));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
  }
  return value;
}

function emptied(value: unknown, key = ""): unknown {
  if (typeof value === "string") return key === "type" ? value : "";
  if (Array.isArray(value)) return value.map((item) => emptied(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, emptied(v, k)]));
  }
  return value;
}

function trimFile(from: string, to: string): void {
  const lines = readFileSync(from, "utf8").split("\n");
  const trimmed = lines.map((line) => {
    if (line.trim() === "") return line;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      // Attachments carry the host's context (skill listings, user details): no run data.
      if (entry.type === "attachment" && typeof entry.attachment === "object") {
        entry.attachment = emptied(entry.attachment);
      }
      return JSON.stringify(walk(entry));
    } catch {
      return line;
    }
  });
  mkdirSync(join(to, ".."), { recursive: true });
  writeFileSync(to, trimmed.join("\n"));
}

trimFile(join(source, `${session}.jsonl`), join(out, `${session}.jsonl`));
const subagents = join(source, session, "subagents");
for (const name of readdirSync(subagents)) {
  const from = join(subagents, name);
  const to = join(out, session, "subagents", name);
  if (name.endsWith(".jsonl")) trimFile(from, to);
  else {
    mkdirSync(join(to, ".."), { recursive: true });
    writeFileSync(to, readFileSync(from));
  }
}
