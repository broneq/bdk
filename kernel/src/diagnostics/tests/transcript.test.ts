// The transcript reader (design D3 of v3-t47-run-diagnostics) against the
// recorded and redacted session of HOST-FACTS `transcript-layout`: typed
// events in file order across the main and subagent files, usage once per
// requestId, skill loads, joined tool results, no thinking, unknown shapes
// counted, the session cost and the states of a missing or unknown file.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { fileStore, memoryStore } from "../../shared/store/index.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { parseTranscript } from "../domain/transcript.ts";
import { persistedOutput, readSession } from "../use-cases/transcripts.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const SESSION = "00000000-0000-4000-8000-000000000001";
const MAIN = join(FIXTURE, `${SESSION}.jsonl`);

function rawLines(path: string): Record<string, unknown>[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** The fixture copied into a memory store at the same paths. */
function fixtureFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(FIXTURE, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[path] = readFileSync(path, "utf8");
  }
  return files;
}

describe("parseTranscript", () => {
  const parsed = parseTranscript(readFileSync(MAIN, "utf8"));

  it("turns the main thread into typed events in file order", () => {
    const kinds = new Set(parsed.events.map((event) => event.kind));
    expect([...kinds].sort()).toStrictEqual(
      ["attachment", "prompt", "skill", "text", "tool-result", "tool-use", "usage"].sort(),
    );
    // The host writes some lines a millisecond out of time order; file order is causal.
    const lines = parsed.events.map((event) => event.line);
    expect(lines).toStrictEqual([...lines].sort((a, b) => a - b));
    const tools = parsed.events.flatMap((event) => (event.kind === "tool-use" ? [event.name] : []));
    expect(tools).toStrictEqual(["Bash", "Bash", "Bash", "Agent", "Agent", "ToolSearch", "Skill"]);
  });

  it("counts usage once per requestId", () => {
    const seen = new Map<string, Record<string, number>>();
    for (const line of rawLines(MAIN)) {
      if (line.type !== "assistant") continue;
      const usage = (line.message as { usage: Record<string, number> }).usage;
      if (!seen.has(line.requestId as string)) seen.set(line.requestId as string, usage);
    }
    const usages = parsed.events.flatMap((event) => (event.kind === "usage" ? [event] : []));
    expect(usages).toHaveLength(seen.size);
    const sum = (key: string) => [...seen.values()].reduce((total, u) => total + (u[key] ?? 0), 0);
    const total = (key: "input" | "output" | "cacheRead" | "cacheWrite") =>
      usages.reduce((all, event) => all + event.tokens[key], 0);
    expect(total("input")).toBe(sum("input_tokens"));
    expect(total("output")).toBe(sum("output_tokens"));
    expect(total("cacheRead")).toBe(sum("cache_read_input_tokens"));
    expect(total("cacheWrite")).toBe(sum("cache_creation_input_tokens"));
    expect(new Set(usages.map((event) => event.model))).toStrictEqual(
      new Set(["claude-haiku-4-5-20251001"]),
    );
  });

  it("names a skill load from its Skill tool use and keeps its text", () => {
    const skills = parsed.events.flatMap((event) => (event.kind === "skill" ? [event] : []));
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("bdk-probe:open-stage");
    expect(skills[0]?.text).toContain("Probe skill `open-stage` loaded.");
  });

  it("joins every tool result to its use, the refused kernel call marked as an error", () => {
    const uses = new Map(
      parsed.events.flatMap((event) => (event.kind === "tool-use" ? [[event.id, event]] : [])),
    );
    const results = parsed.events.flatMap((event) => (event.kind === "tool-result" ? [event] : []));
    expect(results).toHaveLength(uses.size);
    for (const result of results) expect(uses.has(result.id)).toBe(true);
    const refused = results.find((result) => result.text.includes("policy/no-active-change"));
    expect(refused?.error).toBe(true);
    expect(uses.get(refused?.id ?? "")?.name).toBe("Bash");
    const agentResult = results.find((result) => result.text.includes("[Subagent hand-back]"));
    expect(agentResult?.error).toBe(false);
  });

  it("drops thinking and keeps the model's text", () => {
    expect(JSON.stringify(parsed.events)).not.toContain('"thinking"');
    const texts = parsed.events.flatMap((event) => (event.kind === "text" ? [event.text] : []));
    expect(texts.join("\n")).toContain("OPEN-STAGE-LOADED");
  });

  it("reads the session cost from the cost-state line", () => {
    const state = rawLines(MAIN).find((line) => line.type === "cost-state") as {
      totalCostUSD: number;
    };
    expect(parsed.cost).toStrictEqual({
      totalUSD: state.totalCostUSD,
      byModel: { "claude-haiku-4-5-20251001": state.totalCostUSD },
    });
  });

  it("counts lines of an unknown shape and skips bookkeeping lines", () => {
    expect(parsed.unknown).toBe(0);
    const text = [
      '{"type":"brand-new","timestamp":"2026-10-05T15:00:00.000Z"}',
      '{"type":"assistant","timestamp":"2026-10-05T15:00:01.000Z"}',
      "not json",
      '{"type":"last-prompt","lastPrompt":"x"}',
      '{"type":"cost-state","totalCostUSD":"x"}',
    ].join("\n");
    const odd = parseTranscript(text);
    expect(odd.unknown).toBe(4);
    expect(odd.total).toBe(5);
    expect(odd.events).toStrictEqual([]);
    expect(odd.cost).toBeNull();
  });
});

describe("readSession", () => {
  it("reads the main thread and both subagents with their spawning tool use", () => {
    const session = readSession(fileStore(), MAIN);
    expect(session.state).toBe("ok");
    expect(session.unknownLines).toBe(0);
    expect(
      session.agents.map(({ agent, type, toolUseId }) => ({ agent, type, toolUseId })),
    ).toStrictEqual([
      { agent: "main", type: null, toolUseId: null },
      {
        agent: "a0000000000000001",
        type: "bdk-probe:probe-worker",
        toolUseId: "toolu_000000000000000000000004",
      },
      {
        agent: "a0000000000000002",
        type: "bdk-probe:probe-sleeper",
        toolUseId: "toolu_000000000000000000000005",
      },
    ]);
    for (const agent of session.agents) expect(agent.events.length).toBeGreaterThan(0);
    expect(relative(FIXTURE, session.agents[1]?.path ?? "")).toBe(
      `${SESSION}/subagents/agent-a0000000000000001.jsonl`,
    );
    expect(session.cost?.totalUSD).toBeGreaterThan(0);
  });

  it("is unavailable without a transcript path and missing when the file is gone", () => {
    expect(readSession(memoryStore(), null).state).toBe("unavailable");
    const files = Object.entries(fixtureFiles()).filter(([path]) => path !== MAIN);
    expect(readSession(memoryStore(Object.fromEntries(files)), MAIN).state).toBe("missing");
  });

  it("is missing when an expected agent transcript is gone", () => {
    const gone = join(FIXTURE, SESSION, "subagents", "agent-a00000000000000ff.jsonl");
    const session = readSession(memoryStore(fixtureFiles()), MAIN, [gone]);
    expect(session.state).toBe("missing");
    expect(session.agents).toHaveLength(3);
  });

  it("is unreadable when over 10% of the lines have an unknown shape", () => {
    const files = fixtureFiles();
    const lines = (files[MAIN] ?? "").split("\n").filter((line) => line !== "");
    const odd = Array.from({ length: Math.ceil(lines.length / 5) }, () => '{"type":"brand-new"}');
    files[MAIN] = `${[...lines, ...odd].join("\n")}\n`;
    const session = readSession(memoryStore(files), MAIN);
    expect(session.state).toBe("unreadable");
    expect(session.unknownLines).toBe(odd.length);
  });
});

describe("persistedOutput", () => {
  it("reads a tool result the host saved under tool-results/", () => {
    const saved = "/home/u/.claude/projects/p/s/tool-results/hook-1-stdout.txt";
    const text = `<persisted-output>\nOutput too large (10.6KB). Full output saved to: ${saved}\n\nPreview (first 2KB):\n# BDK`;
    const store = memoryStore({ [saved]: "# BDK Shared Foundation\nwhole\n" });
    expect(persistedOutput(store, text)).toBe("# BDK Shared Foundation\nwhole\n");
    expect(persistedOutput(memoryStore(), text)).toBe(text);
    expect(persistedOutput(store, "plain")).toBe("plain");
  });
});
