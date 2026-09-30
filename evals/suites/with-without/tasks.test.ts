import { describe, expect, it } from "vitest";

import { EXAMPLE_TASKS } from "./suite.ts";
import { TaskFileError, parseTasks, readTasks } from "./tasks.ts";

describe("parseTasks", () => {
  it("reads id, prompt and optional assertions", () => {
    const tasks = parseTasks(
      [
        "- id: login-flow",
        "  prompt: Draw the login.",
        "  assert:",
        "    - type: contains",
        "      value: sequenceDiagram",
        "- id: plain",
        "  prompt: Explain.",
      ].join("\n"),
      "t.yaml",
    );
    expect(tasks).toEqual([
      {
        id: "login-flow",
        prompt: "Draw the login.",
        assert: [{ type: "contains", value: "sequenceDiagram" }],
      },
      { id: "plain", prompt: "Explain." },
    ]);
  });

  it("names every broken entry in one error", () => {
    const text = [
      "- id: ok",
      "  prompt: Fine.",
      "- id: ok",
      "  prompt: Twice.",
      "- id: Bad Id",
      "  prompt: ''",
      "  assert: nope",
      "- id: extra",
      "  prompt: x",
      "  vars: {}",
      "- just text",
    ].join("\n");
    let error: unknown;
    try {
      parseTasks(text, "t.yaml");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TaskFileError);
    const message = (error as Error).message;
    expect(message).toMatch(/^t\.yaml: /);
    expect(message).toContain("entry 2 (ok): id is not unique");
    expect(message).toContain("entry 3 (Bad Id): id must be lowercase letters, digits and dashes");
    expect(message).toContain("entry 3 (Bad Id): prompt must be a non-empty string");
    expect(message).toContain("entry 3 (Bad Id): assert must be a list of promptfoo assertions");
    expect(message).toContain("entry 4 (extra): unknown field vars");
    expect(message).toContain("entry 5 is not a mapping");
  });

  it("refuses a file that is not a non-empty list", () => {
    expect(() => parseTasks("id: x\n", "t.yaml")).toThrow(/non-empty list/);
    expect(() => parseTasks("[]\n", "t.yaml")).toThrow(/non-empty list/);
  });
});

describe("the example task file", () => {
  it("parses, and every task asserts something", () => {
    const tasks = readTasks(EXAMPLE_TASKS);
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(tasks.filter((task) => (task.assert ?? []).length === 0)).toEqual([]);
  });
});
