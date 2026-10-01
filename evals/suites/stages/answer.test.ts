import { describe, expect, it } from "vitest";

import { answerHookOutput, answerHookSettings } from "./answer.ts";

const input = {
  questions: [
    {
      question: "Create a new branch or stay on main?",
      header: "Branch",
      options: [{ label: "Create feat/dark-mode" }, { label: "Stay on main" }],
      multiSelect: false,
    },
    {
      question: "Which commands should BDK use?",
      header: "Commands",
      options: [{ label: "npm test" }, { label: "npm run lint" }],
      multiSelect: true,
    },
  ],
};

describe("answerHookOutput", () => {
  it("answers a question whose header or text matches a key, else with the first option", () => {
    expect(answerHookOutput(input, { branch: "^stay" })).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: {
          ...input,
          answers: {
            "Create a new branch or stay on main?": "Stay on main",
            "Which commands should BDK use?": "npm test",
          },
        },
      },
    });
  });

  it("passes an answer that is no option through as free text, like Other", () => {
    const output = answerHookOutput(input, { "which commands": "pnpm test" });
    expect(output.hookSpecificOutput.updatedInput.answers["Which commands should BDK use?"]).toBe(
      "pnpm test",
    );
  });

  it("answers nothing for a question without options", () => {
    const output = answerHookOutput(
      { questions: [{ question: "Name?", header: "Name", options: [] }] },
      {},
    );
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({});
  });
});

describe("answerHookSettings", () => {
  it("runs the hook on AskUserQuestion with the case's answers file", () => {
    expect(answerHookSettings("/h/answer-hook.ts", "/r/answers.json")).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: "AskUserQuestion",
            hooks: [{ type: "command", command: "node '/h/answer-hook.ts' '/r/answers.json'" }],
          },
        ],
      },
    });
  });
});
