// `plugin-tooling`, Ported repository guards: the host probe collector
// anonymises what it records, and no committed host payload leaks machine
// data. The recordings are committed to a public repository, so the
// anonymisation is the part of the probe that must not regress.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

const PROBE_DIR = join(REPO_ROOT, "tests", "host-probe");
const COLLECT = join(PROBE_DIR, "collect.mjs");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures", "host-payloads");

const HOME = "/Users/alice";
const PROJECT = "/private/tmp/probe/work-project";
const SESSION = "8cc1c683-fc2f-406c-8ffa-580ff15b26fa";
const OTHER_SESSION = "11111111-2222-3333-4444-555555555555";

type Json = Record<string, unknown>;

function encoded(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}

function payload(extra: Json = {}, session = SESSION): Json {
  return {
    session_id: session,
    transcript_path: `${HOME}/.claude/projects/${encoded(PROJECT)}/${session}.jsonl`,
    cwd: PROJECT,
    scratchpad_dir: `${HOME}/tmp/alice-scratch`,
    prompt_id: "c85dfd80-14a9-44a1-8480-2f788aec0b6d",
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: `ls ${PROJECT}/src`, timeout: 120000, run_in_background: false },
    tool_use_id: "toolu_01AbCdEf",
    ...extra,
  };
}

/** Runs the collector on `recordings` for the check `pair` (`<id>=<glob>`). */
function collect(pair: string, recordings: Record<string, Json>, env: Record<string, string> = {}) {
  const work = mkdtempSync(join(tmpdir(), "bdk-host-probe-"));
  const out = join(work, ".probe-out");
  mkdirSync(out);
  for (const [name, body] of Object.entries(recordings)) {
    writeFileSync(join(out, name), JSON.stringify(body));
  }
  const dest = join(work, "fixtures");
  const result = spawnSync(process.execPath, [COLLECT, "9.9.9", pair], {
    cwd: work,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME,
      PROBE_OUT: out,
      PROBE_PROJECT: PROJECT,
      BDK_FIXTURES: dest,
      ...env,
    },
  });
  const id = pair.split("=")[0] ?? "";
  const file = join(dest, "9.9.9", `${id}.json`);
  return {
    status: result.status,
    stderr: result.stderr,
    file,
    text: () => readFileSync(file, "utf8"),
    fixture: () => JSON.parse(readFileSync(file, "utf8")) as { payloads: Json[]; _probe: Json },
  };
}

function firstPayload(run: ReturnType<typeof collect>): Json {
  expect(run.status, run.stderr).toBe(0);
  const [first] = run.fixture().payloads;
  if (first === undefined) throw new Error("no payload recorded");
  return first;
}

describe("host probe collector", () => {
  it("replaces paths, including their encoded forms", () => {
    const run = collect("pre-bash=*-PreToolUse.json", { "1-1-PreToolUse.json": payload() });
    const p = firstPayload(run);
    for (const leak of [HOME, PROJECT, encoded(PROJECT), encoded(HOME), "alice"]) {
      expect(run.text()).not.toContain(leak);
    }
    expect(p.cwd).toBe("<PROJECT>");
    expect(p.tool_input).toMatchObject({ command: "ls <PROJECT>/src" });
    expect(p.transcript_path).toMatch(/^<HOME>\/\.claude\/projects\/<PROJECT>\//);
    expect(p.scratchpad_dir).toBe("<HOME>/tmp/<USER>-scratch");
  });

  it("replaces the plugin root", () => {
    const body = payload({ tool_input: { command: `node ${PROBE_DIR}/dist/bdk.mjs ping` } });
    const p = firstPayload(collect("root=*-PreToolUse.json", { "1-1-PreToolUse.json": body }));
    expect(p.tool_input).toStrictEqual({ command: "node <PLUGIN_ROOT>/dist/bdk.mjs ping" });
  });

  it.each(["/private/tmp/claude-502", "/tmp/claude-502"])(
    "replaces the per-user Claude temp dir %s",
    (prefix) => {
      const body = payload({
        scratchpad_dir: `${prefix}/${encoded(PROJECT)}/${SESSION}/scratchpad`,
      });
      const p = firstPayload(collect("tmp=*-PreToolUse.json", { "1-1-PreToolUse.json": body }));
      expect(p.scratchpad_dir).toBe(`<CLAUDE_TMP>/<PROJECT>/${String(p.session_id)}/scratchpad`);
    },
  );

  it("replaces the git identity and e-mail addresses", () => {
    const config = join(mkdtempSync(join(tmpdir(), "bdk-gitconfig-")), "gitconfig");
    writeFileSync(config, "[user]\n\tname = Alice Example\n\temail = alice@example.org\n");
    const output = "L-1 finding | author: Alice Example <alice@example.org>, cc bob@example.com";
    const body = payload({ tool_response: { stdout: output } });
    const p = firstPayload(
      collect(
        "git=*-PreToolUse.json",
        { "1-1-PreToolUse.json": body },
        { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1" },
      ),
    );
    expect(p.tool_response).toStrictEqual({
      stdout: "L-1 finding | author: <GIT_NAME> <<EMAIL>>, cc <EMAIL>",
    });
  });

  it("maps ids to stable placeholders", () => {
    const run = collect("two=*-PreToolUse.json", {
      "1-1-PreToolUse.json": payload(),
      "2-2-PreToolUse.json": payload(),
      "3-3-PreToolUse.json": payload({}, OTHER_SESSION),
    });
    expect(run.status, run.stderr).toBe(0);
    const [first, second, third] = run.fixture().payloads;
    expect(first?.session_id).toBe(second?.session_id);
    expect(first?.session_id).not.toBe(third?.session_id);
    expect(first?.session_id).toMatch(/^<SESSION-/);
    expect(first?.transcript_path).toMatch(new RegExp(`/${String(first?.session_id)}\\.jsonl$`));
    expect(first?.tool_use_id).toMatch(/^<TOOL-USE-/);
    expect(first?.prompt_id).toMatch(/^<PROMPT-/);
    expect(JSON.stringify(first)).not.toContain(SESSION);
  });

  it("keeps keys, types and nesting", () => {
    const body = payload({ agent_id: "a1b2c3d4e5", agent_type: "bdk-probe:probe-worker" });
    const p = firstPayload(collect("agent=*-PreToolUse.json", { "1-1-PreToolUse.json": body }));
    expect(Object.keys(p).sort()).toStrictEqual(Object.keys(body).sort());
    expect(p.tool_input).toMatchObject({ timeout: 120000, run_in_background: false });
    expect(p.agent_id).toMatch(/^<AGENT-/);
    expect(p.agent_type).toBe("bdk-probe:probe-worker");
  });

  it("adds the probe metadata", () => {
    const run = collect("meta=*-PreToolUse.json", { "1-1-PreToolUse.json": payload() });
    expect(run.status, run.stderr).toBe(0);
    expect(run.fixture()._probe).toMatchObject({
      claude_code_version: "9.9.9",
      check_id: "meta",
      recordings: 1,
    });
  });

  it("fails and names the check when a recording is missing", () => {
    const run = collect("absent=*-SessionEnd.json", { "1-1-PreToolUse.json": payload() });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("absent");
    expect(() => run.text()).toThrow();
  });
});

// BDK's own role and adapter names, which fixtures hold by design (`bdk:runner`).
const BDK_NAMES = new Set([
  "implementer",
  "simplifier",
  "verifier",
  "reviewer",
  "runner",
  "scout",
  "lead",
  "worker",
  "reader",
]);

/**
 * Machine data in `text`: home prefixes (plain or dash-encoded), e-mails and
 * the user name. The name counts only as a standalone token, and not at all
 * when it is a BDK role or adapter name: the GitHub runner's user is `runner`.
 */
function leaks(text: string, user: string): string[] {
  const found = ["/Users/", "/home/", "-Users-", "-home-"].filter((marker) =>
    text.includes(marker),
  );
  found.push(...(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []));
  const name = new RegExp(
    `(?<![A-Za-z0-9_-])${user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`,
  );
  if (!BDK_NAMES.has(user) && name.test(text)) found.push(user);
  return found;
}

function committedFixtures(): string[] {
  return readdirSync(FIXTURES, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".json"))
    .sort();
}

describe("host payload leak guard", () => {
  it.each([
    "/Users/alice/x",
    "-Users-alice-project",
    "/tmp/alice-scratch",
    "owner: alice",
    "author: <GIT_NAME> <alice@example.org>",
  ])("flags machine data in %s", (text) => {
    expect(leaks(text, "alice")).not.toStrictEqual([]);
  });

  it.each(["bdk:test-runner", "runners", "<USER>-scratch", "subagent_type: bdk:runner"])(
    "ignores the user name inside %s",
    (text) => {
      expect(leaks(text, "runner")).toStrictEqual([]);
    },
  );

  it.each(committedFixtures())("%s leaks no machine data", (fixture) => {
    const text = readFileSync(join(FIXTURES, fixture), "utf8");
    expect(
      leaks(text, userInfo().username),
      relative(REPO_ROOT, join(FIXTURES, fixture)),
    ).toStrictEqual([]);
  });
});
