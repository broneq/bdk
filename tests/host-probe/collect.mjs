#!/usr/bin/env node
// Copy recorded hook payloads into committed fixtures, anonymised.
//
//   node collect.mjs <claude-code-version> <check-id>=<recording-glob>...
//
// PROBE_OUT      recordings directory (default ./.probe-out)
// PROBE_PROJECT  scratch project path to hide (default: current directory)
// BDK_FIXTURES   fixture root (default ../fixtures/host-payloads next to this file)
//
// Output: <BDK_FIXTURES>/<version>/<check-id>.json = {"_probe": {...}, "payloads": [...]}.
// Exits 1 without writing that check when a glob matches nothing.
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [version, ...pairs] = process.argv.slice(2);
if (!version || pairs.length === 0) {
  console.error("usage: collect.mjs <claude-code-version> <check-id>=<recording-glob>...");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const probeOut = process.env.PROBE_OUT ?? ".probe-out";
const fixtureRoot = process.env.BDK_FIXTURES ?? join(here, "..", "fixtures", "host-payloads");
const home = process.env.HOME ?? "";
const project = process.env.PROBE_PROJECT ?? process.cwd();

const encode = (path) => path.replace(/[^a-zA-Z0-9]/g, "-");
const variants = (path) => {
  const all = new Set([path]);
  try { all.add(realpathSync(path)); } catch { /* path may not exist on this machine */ }
  for (const p of [...all]) {
    if (p.startsWith("/private/")) all.add(p.slice("/private".length));
  }
  return [...all].filter(Boolean);
};

// Longest first, so the project path and the probe's own directory (the expanded
// ${CLAUDE_PLUGIN_ROOT}) win over the home directory they may sit in.
const replacements = [
  ...variants(here).flatMap((p) => [[p, "<PLUGIN_ROOT>"], [encode(p), "<PLUGIN_ROOT>"]]),
  ...variants(project).flatMap((p) => [[p, "<PROJECT>"], [encode(p), "<PROJECT>"]]),
  ...(home ? [[home, "<HOME>"], [encode(home), "<HOME>"]] : []),
].sort((a, b) => b[0].length - a[0].length);
const user = basename(home);

const ID_KEYS = { session_id: "SESSION", prompt_id: "PROMPT", agent_id: "AGENT", tool_use_id: "TOOL-USE" };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Claude Code's per-user temp root (e.g. scratchpad_dir) embeds the numeric user ID.
const CLAUDE_TMP = /(?:\/private)?\/tmp\/claude-\d+/g;
const placeholders = new Map();
const counters = {};
const placeholderFor = (value, kind) => {
  if (!placeholders.has(value)) {
    counters[kind] = (counters[kind] ?? 0) + 1;
    placeholders.set(value, `<${kind}-${counters[kind]}>`);
  }
  return placeholders.get(value);
};

// Pass 1: learn every ID value from its key, so the same value inside a path maps the same way.
const learnIds = (node) => {
  if (Array.isArray(node)) return node.forEach(learnIds);
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (ID_KEYS[key] && typeof value === "string" && value) placeholderFor(value, ID_KEYS[key]);
      else learnIds(value);
    }
  }
};

const scrubString = (text) => {
  let out = text;
  for (const [value, placeholder] of placeholders) out = out.split(value).join(placeholder);
  for (const [from, to] of replacements) out = out.split(from).join(to);
  if (user) out = out.split(user).join("<USER>");
  out = out.replace(CLAUDE_TMP, "<CLAUDE_TMP>");
  return out.replace(UUID, (match) => placeholderFor(match, "UUID"));
};

const scrub = (node) => {
  if (typeof node === "string") return scrubString(node);
  if (Array.isArray(node)) return node.map(scrub);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, scrub(v)]));
  }
  return node;
};

const globToRegExp = (glob) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);

let names;
try {
  names = readdirSync(probeOut).sort();
} catch {
  console.error(`collect: recordings directory not found: ${probeOut}`);
  process.exit(1);
}

const checks = pairs.map((pair) => {
  const [checkId, glob] = pair.split("=");
  if (!checkId || !glob) {
    console.error(`collect: expected <check-id>=<glob>, got ${pair}`);
    process.exit(2);
  }
  const matched = names.filter((n) => globToRegExp(glob).test(n));
  const payloads = matched.map((n) => JSON.parse(readFileSync(join(probeOut, n), "utf8")));
  payloads.forEach(learnIds);
  return { checkId, glob, payloads };
});

const dest = join(fixtureRoot, version);
mkdirSync(dest, { recursive: true });
let failed = false;
for (const { checkId, glob, payloads } of checks) {
  if (payloads.length === 0) {
    console.error(`collect: check ${checkId}: no recording matches ${glob} in ${probeOut}`);
    failed = true;
    continue;
  }
  const fixture = {
    _probe: { claude_code_version: version, check_id: checkId, recordings: payloads.length },
    payloads: payloads.map(scrub),
  };
  writeFileSync(join(dest, `${checkId}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`collect: ${checkId} <- ${payloads.length} recording(s)`);
}
process.exit(failed ? 1 : 0);
