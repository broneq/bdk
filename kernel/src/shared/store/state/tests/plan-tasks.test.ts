import { describe, expect, it } from "vitest";

import { hasPlaceholder, parsePlanTasks, planPlaceholders } from "../plan.ts";
import * as example from "./examples.ts";

const BODY = `Intro text the kernel ignores.

## 02-1 Add login route

Some notes with **See:** \`src/x.ts:4\`.

**Depends on:** none

**Files:**
- Create: \`src/auth/login.ts\`
- Modify: \`src/app.ts\` - wire the route
- Test: \`src/auth/login.test.ts\`
- \`docs/login.md\`

**Test cases:**
- a valid link logs the user in
- a reused link is refused

**Stop rule:** the session store has no expiry

## 02-2 Wire config

**Depends on:** 02-1

**Files:**
- Delete: \`config/old.yaml\`

**Verification:** none

## Notes

Free text after the tasks.
`;

describe("parsePlanTasks", () => {
  it("reads tasks, their fields and ignores free text", () => {
    const parsed = parsePlanTasks(BODY);
    expect(parsed.problems).toStrictEqual([]);
    expect(parsed.tasks).toStrictEqual([
      {
        id: "02-1",
        title: "Add login route",
        files: [
          { path: "src/auth/login.ts", action: "Create" },
          { path: "src/app.ts", action: "Modify" },
          { path: "src/auth/login.test.ts", action: "Test" },
          { path: "docs/login.md" },
        ],
        testCases: ["a valid link logs the user in", "a reused link is refused"],
        dependsOn: [],
        stopRule: "the session store has no expiry",
      },
      {
        id: "02-2",
        title: "Wire config",
        files: [{ path: "config/old.yaml", action: "Delete" }],
        verification: "none",
        dependsOn: ["02-1"],
      },
    ]);
  });

  it("reports a task without Files", () => {
    const parsed = parsePlanTasks("## 01-1 Do it\n\n**Verification:** none\n");
    expect(parsed.problems).toStrictEqual(["task 01-1 has no **Files:** list"]);
  });

  it("reports a Files item without a backticked path", () => {
    const parsed = parsePlanTasks(
      "## 01-1 Do it\n\n**Files:**\n- src/a.ts\n\n**Verification:** none\n",
    );
    expect(parsed.problems).toStrictEqual([
      "task 01-1: **Files:** item 'src/a.ts' holds no backticked path",
    ]);
  });

  it("reports a task with neither Test cases nor Verification none", () => {
    const parsed = parsePlanTasks("## 01-1 Do it\n\n**Files:**\n- `a.ts`\n");
    expect(parsed.problems).toStrictEqual([
      "task 01-1 has neither **Test cases:** nor **Verification:** none",
    ]);
  });

  it("reports an empty Test cases list and a Verification other than none", () => {
    expect(
      parsePlanTasks("## 01-1 Do it\n\n**Files:**\n- `a.ts`\n\n**Test cases:**\n").problems,
    ).toStrictEqual(["task 01-1 has neither **Test cases:** nor **Verification:** none"]);
    expect(
      parsePlanTasks("## 01-1 Do it\n\n**Files:**\n- `a.ts`\n\n**Verification:** manual\n")
        .problems,
    ).toStrictEqual(["task 01-1: **Verification:** must be none, not 'manual'"]);
  });

  it("reports duplicate ids and unknown dependencies", () => {
    const task = (id: string, depends: string) =>
      `## ${id} T\n\n**Depends on:** ${depends}\n\n**Files:**\n- \`a.ts\`\n\n**Verification:** none\n\n`;
    const parsed = parsePlanTasks(task("01-1", "none") + task("01-1", "01-7"));
    expect(parsed.problems).toStrictEqual([
      "task id 01-1 appears twice",
      "task 01-1 depends on 01-7, which this part does not hold",
    ]);
  });

  it("reports a numbered heading that is not a task id", () => {
    const parsed = parsePlanTasks("## 1-1 Bad\n\n## Task 2: Also bad\n");
    expect(parsed.problems).toStrictEqual(["heading '## 1-1 Bad' is not '## <nn>-<k> <title>'"]);
    expect(parsed.tasks).toStrictEqual([]);
  });
});

describe("hasPlaceholder", () => {
  it.each([
    "TODO",
    "fix TODO later",
    "TBD",
    "FIXME: x",
    "<fill in>",
    "see [...]",
    "...",
    "…",
    "[Action verb + what]",
    "  [x]  ",
  ])("finds %j", (text) => {
    expect(hasPlaceholder(text)).toBe(true);
  });

  it.each([
    "TODOS are tracked elsewhere",
    "todo in lower case is prose",
    "wait... then retry",
    "a [link](http://x) in text",
    "use `arr[...rest]`? no: rest...",
  ])("does not flag %j", (text) => {
    expect(hasPlaceholder(text)).toBe(false);
  });
});

describe("planPlaceholders", () => {
  it("names each executable field holding a placeholder", () => {
    const frontmatter = { ...example.planPart, goal: "TBD" };
    const body = `## 02-1 [Action verb + what]

**Files:**
- \`src/a.ts\`
- \`TODO\`

**Test cases:**
- TODO

**Stop rule:** ...
`;
    expect(planPlaceholders(frontmatter, parsePlanTasks(body).tasks)).toStrictEqual([
      "goal",
      "task 02-1 title",
      "task 02-1 **Files:** item 2",
      "task 02-1 **Test cases:** item 1",
      "task 02-1 **Stop rule:**",
    ]);
  });

  it("names a placeholder in isolation-reason", () => {
    const frontmatter = { ...example.planPart, isolation: "worktree", "isolation-reason": "TBD" };
    expect(planPlaceholders(frontmatter, parsePlanTasks(BODY).tasks)).toStrictEqual([
      "isolation-reason",
    ]);
  });

  it("passes a clean part", () => {
    expect(planPlaceholders(example.planPart, parsePlanTasks(BODY).tasks)).toStrictEqual([]);
  });
});
