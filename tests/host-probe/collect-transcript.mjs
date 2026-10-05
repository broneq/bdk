#!/usr/bin/env node
// Copy the host transcripts of one recorded probe session into a committed
// fixture, redacted, for the run diagnostics transcript reader (T47).
//
//   node collect-transcript.mjs <claude-code-version> <check-id>
//
// PROBE_OUT      recordings directory (default ./.probe-out)
// PROBE_PROJECT  scratch project path to hide (default: current directory)
// BDK_FIXTURES   fixture root (default ../fixtures/host-transcripts next to this file)
//
// Output: <BDK_FIXTURES>/<version>/<check-id>/ with `hooks.jsonl` (the session's
// hook payloads in time order) and the host's own layout: `<session>.jsonl` (the
// main transcript) and `<session>/subagents/agent-<id>.jsonl` plus `.meta.json`. Ids keep their shape so a
// reader cannot tell a fixture from a live session: the session id, agent ids,
// uuids and request ids are replaced by counters of the same length.
//
// Redaction: attachments keep only their `type` (they carry the user's
// instructions, hook context and environment); thinking text and signatures
// are dropped; paths of the home directory, the project and this repository
// are replaced; e-mail addresses and the git name are replaced.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [version, check] = process.argv.slice(2);
if (!version || !check) {
  console.error("usage: collect-transcript.mjs <claude-code-version> <check-id>");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const probeOut = process.env.PROBE_OUT ?? ".probe-out";
const fixtureRoot = process.env.BDK_FIXTURES ?? join(here, "..", "fixtures", "host-transcripts");
const home = process.env.HOME ?? "";
const project = process.env.PROBE_PROJECT ?? process.cwd();

const variants = (path) => {
  const all = new Set([path]);
  try {
    all.add(realpathSync(path));
  } catch {
    /* path may not exist on this machine */
  }
  for (const p of [...all]) if (p.startsWith("/private/")) all.add(p.slice("/private".length));
  return [...all].filter(Boolean);
};
const encode = (path) => path.replace(/[^a-zA-Z0-9]/g, "-");
// Longest first, so the project and the repository win over the home they sit in.
const replacements = [
  ...variants(repo).flatMap((p) => [
    [p, "/plugin"],
    [encode(p), "-plugin"],
  ]),
  ...variants(project).flatMap((p) => [
    [p, "/work/project"],
    [encode(p), "-work-project"],
  ]),
  ...(home
    ? [
        [home, "/home/user"],
        [encode(home), "-home-user"],
      ]
    : []),
].sort((a, b) => b[0].length - a[0].length);

const gitName = (() => {
  try {
    return execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
})();
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CLAUDE_TMP = /(?:\/private)?\/tmp\/claude-\d+/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const AGENT = /\ba[0-9a-f]{16}\b/g;
const REQUEST = /\breq_[A-Za-z0-9]{20,}\b/g;
const TOOL_USE = /\btoolu_[A-Za-z0-9]{20,}\b/g;

const maps = { uuid: new Map(), agent: new Map(), request: new Map(), tool: new Map() };
const fake = (kind, value, make) => {
  const map = maps[kind];
  if (!map.has(value)) map.set(value, make(map.size + 1));
  return map.get(value);
};
const hex = (n, width) => n.toString(16).padStart(width, "0");
const scrubString = (text) => {
  let out = text;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  if (gitName) out = out.split(gitName).join("Probe User");
  return out
    .replace(EMAIL, "user@example.com")
    .replace(CLAUDE_TMP, "/tmp/claude-0")
    .replace(UUID, (m) =>
      fake("uuid", m.toLowerCase(), (n) => `00000000-0000-4000-8000-${hex(n, 12)}`),
    )
    .replace(AGENT, (m) => fake("agent", m, (n) => `a${hex(n, 16)}`))
    .replace(REQUEST, (m) => fake("request", m, (n) => `req_${hex(n, 24)}`))
    .replace(TOOL_USE, (m) => fake("tool", m, (n) => `toolu_${hex(n, 24)}`));
};
const scrub = (node) => {
  if (typeof node === "string") return scrubString(node);
  if (Array.isArray(node)) return node.map(scrub);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, scrub(v)]));
  }
  return node;
};

/** One transcript line, redacted. */
const redactLine = (entry) => {
  if (entry.type === "attachment" && entry.attachment && typeof entry.attachment === "object") {
    const { rendered: _rendered, ...rest } = entry;
    return scrub({ ...rest, attachment: { type: entry.attachment.type } });
  }
  if (entry.type === "assistant" && Array.isArray(entry.message?.content)) {
    const content = entry.message.content.map((block) =>
      block.type === "thinking" ? { type: "thinking", thinking: "redacted" } : block,
    );
    return scrub({ ...entry, message: { ...entry.message, content } });
  }
  return scrub(entry);
};

const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
const writeJsonl = (path, entries) =>
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");

const payloadFiles = readdirSync(probeOut)
  .filter((name) => name.startsWith(`${check}--`) && /^\d/.test(name.slice(check.length + 2)))
  .sort();
if (payloadFiles.length === 0) {
  console.error(`collect-transcript: no payloads of ${check} in ${probeOut}`);
  process.exit(1);
}
const payloads = payloadFiles.map((name) => JSON.parse(readFileSync(join(probeOut, name), "utf8")));
const main = payloads.find((p) => typeof p.transcript_path === "string")?.transcript_path;
if (!main || !existsSync(main)) {
  console.error(`collect-transcript: the main transcript of ${check} is gone: ${main}`);
  process.exit(1);
}

const target = join(fixtureRoot, version, check);
const session = scrubString(basename(main, ".jsonl"));
rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, session, "subagents"), { recursive: true });
writeJsonl(join(target, `${session}.jsonl`), readJsonl(main).map(redactLine));
const subagents = join(main.slice(0, -".jsonl".length), "subagents");
for (const name of existsSync(subagents) ? readdirSync(subagents).sort() : []) {
  const source = join(subagents, name);
  const out = join(target, session, "subagents", scrubString(name));
  if (name.endsWith(".jsonl")) writeJsonl(out, readJsonl(source).map(redactLine));
  else if (name.endsWith(".meta.json")) {
    writeFileSync(out, `${JSON.stringify(scrub(JSON.parse(readFileSync(source, "utf8"))))}\n`);
  }
}
writeJsonl(join(target, "hooks.jsonl"), payloads.map(scrub));
console.log(`wrote ${target}/${session}.jsonl and its subagents`);
