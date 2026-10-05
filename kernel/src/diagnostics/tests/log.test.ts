// The log file writer (`kernel-state`, Verbose log: 20 MiB per file, oldest
// half dropped) and the event lines of the render (`kernel-cli/diagnostics`,
// bdk diagnostics log: collapsed to 20 lines unless --full, kernel stdout whole).
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { eventLines } from "../domain/log.ts";
import { eventIndex, sliceAround } from "../domain/slice.ts";
import type { AgentTranscript, TranscriptEvent } from "../domain/transcript.ts";
import { writeLogFile } from "../use-cases/logs.ts";

const AT = "2026-10-05T14:03:39.120Z";
const LONG = Array.from({ length: 30 }, (_, index) => `line ${String(index + 1)}`).join("\n");

function result(id: string): TranscriptEvent {
  return { kind: "tool-result", id, text: LONG, error: false, at: AT, line: 7 };
}

describe("eventLines", () => {
  const options = { full: false, kernelUses: new Set(["toolu_kernel"]) };

  it("collapses a tool result to 20 lines and says how many it left out", () => {
    const lines = eventLines(result("toolu_other"), "a1", "  ", options);
    expect(lines[0]).toBe("14:03:39   a1 result line 1");
    expect(lines).toHaveLength(21);
    expect(lines.at(-1)).toBe("      ... 10 more lines");
  });

  it("prints kernel stdout whole, and everything whole with --full", () => {
    expect(eventLines(result("toolu_kernel"), "main", "", options)).toHaveLength(30);
    expect(eventLines(result("toolu_other"), "main", "", { ...options, full: true })).toHaveLength(
      30,
    );
  });

  it("puts a tool call's input on one line", () => {
    const use: TranscriptEvent = {
      kind: "tool-use",
      id: "t",
      name: "Bash",
      input: { command: "a \\\n  b" },
      at: AT,
      line: 3,
    };
    expect(eventLines(use, "main", "", options)).toStrictEqual(["14:03:39 main Bash a \\ b"]);
  });
});

describe("writeLogFile", () => {
  it("drops the oldest half of the lines past the limit", () => {
    const store = memoryStore();
    const lines = Array.from(
      { length: 100 },
      (_, index) => `line ${String(index).padStart(3, "0")}`,
    );
    const written = writeLogFile(store, "/p", "s.log", lines, 600);
    expect(written.lines).toBe(50);
    expect(store.read("/p/.bdk/.machine/logs/s.log")?.startsWith("line 050\n")).toBe(true);
  });
});

describe("eventIndex and sliceAround", () => {
  const events: TranscriptEvent[] = [3, 5, 9].map((line, index) => ({
    kind: "text",
    text: `step ${String(index + 1)}`,
    at: `2026-10-05T14:03:3${String(index)}.000Z`,
    line,
  }));
  const agent = (list: readonly TranscriptEvent[]): AgentTranscript => ({
    agent: "a1",
    type: null,
    toolUseId: null,
    path: "/t/a1.jsonl",
    events: list,
  });
  const transcript = agent(events);

  it("finds the event at or after a line or a time, and the last one past the end", () => {
    expect(eventIndex(transcript, { line: 4 })).toBe(1);
    expect(eventIndex(transcript, { line: 10 })).toBe(-1);
    expect(eventIndex(transcript, { at: "2026-10-05T14:03:31.000Z" })).toBe(1);
    expect(eventIndex(transcript, { at: "2026-10-05T15:00:00.000Z" })).toBe(2);
  });

  it("keeps the window inside the transcript and cuts the lines it leaves out", () => {
    expect(sliceAround(transcript, 0, 5, 0)).toStrictEqual({
      agent: "a1",
      at: "2026-10-05T14:03:30.000Z",
      events: ["14:03:30 a1 says step 1"],
      omitted: 0,
    });
    const long: TranscriptEvent = { kind: "text", text: LONG.repeat(10), at: AT, line: 1 };
    const cut = sliceAround(agent([long, long, long]), 1, 1, 1);
    expect(cut.events).toHaveLength(200);
    expect(cut.omitted).toBeGreaterThan(0);
    expect(sliceAround(transcript, 9, 0, 0).at).toBe("");
  });
});
