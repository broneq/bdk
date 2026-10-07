import { describe, expect, it } from "vitest";

import { renderCheck } from "../render/check.ts";
import type { CheckResult } from "../schema/check.ts";

// The text of spec `bdk-cli/plan`, "Check output".

const LIMITS = { maxTasks: 5, maxFiles: 10, maxBytes: 8192 };

describe("renderCheck", () => {
  it("prints summary, waves, aligned parts and problems", () => {
    const result: CheckResult = {
      ok: false,
      limits: LIMITS,
      parts: [
        {
          id: "01",
          isolation: "worktree",
          dependsOn: [],
          tasks: 4,
          files: 9,
          bytes: 5120,
          wave: 1,
        },
        {
          id: "02",
          isolation: "shared",
          dependsOn: ["01"],
          tasks: 6,
          files: 3,
          bytes: 900,
          wave: 2,
        },
        {
          id: "03",
          isolation: null,
          dependsOn: ["01", "02"],
          tasks: 2,
          files: 12,
          bytes: 1300,
          wave: null,
        },
      ],
      waves: [
        { wave: 1, parts: ["01"] },
        { wave: 2, parts: ["02"] },
      ],
      problems: [
        {
          check: "frontmatter",
          parts: ["03"],
          message: "isolation is missing, not worktree or shared",
        },
        { check: "max-tasks", parts: ["02"], message: "6 tasks, above plan.part.max-tasks 5" },
      ],
    };
    expect(renderCheck(result)).toBe(
      [
        "plan: 3 parts, 2 waves, 2 problems",
        "waves:",
        "  1: 01",
        "  2: 02",
        "parts:",
        "  01  worktree  tasks 4/5  files 9/10   bytes 5120/8192  wave 1  depends-on -",
        "  02  shared    tasks 6/5  files 3/10   bytes 900/8192   wave 2  depends-on 01",
        "  03  -         tasks 2/5  files 12/10  bytes 1300/8192  wave -  depends-on 01,02",
        "problems:",
        "  frontmatter 03: isolation is missing, not worktree or shared",
        "  max-tasks 02: 6 tasks, above plan.part.max-tasks 5",
        "",
      ].join("\n"),
    );
  });

  it("says ok without problems and uses the singular", () => {
    expect(
      renderCheck({
        ok: true,
        limits: LIMITS,
        parts: [
          {
            id: "01",
            isolation: "worktree",
            dependsOn: [],
            tasks: 1,
            files: 1,
            bytes: 10,
            wave: 1,
          },
        ],
        waves: [{ wave: 1, parts: ["01"] }],
        problems: [],
      }),
    ).toBe(
      "plan: 1 part, 1 wave, ok\nwaves:\n  1: 01\nparts:\n  01  worktree  tasks 1/5  files 1/10  bytes 10/8192  wave 1  depends-on -\n",
    );
  });

  it("prints an empty plan and a problem without parts", () => {
    expect(
      renderCheck({
        ok: false,
        limits: LIMITS,
        parts: [],
        waves: [],
        problems: [
          { check: "no-parts", parts: [], message: "the directory holds no part file NN.md" },
        ],
      }),
    ).toBe(
      "plan: 0 parts, 0 waves, 1 problem\nwaves: none\nparts: none\nproblems:\n  no-parts: the directory holds no part file NN.md\n",
    );
  });
});
